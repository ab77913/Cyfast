"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  EXECUTION_STATUS,
  InvalidExecutionTransitionError,
  assertTransition,
  validateExecutionResult,
  ExecutionLifecycleOrchestrator,
} = require("../services/execution_lifecycle");

class InMemoryRepository {
  constructor() {
    this.executions = new Map();
    this.events = [];
  }

  async createExecution(execution) {
    const stored = structuredClone(execution);
    this.executions.set(stored.id, stored);
    return structuredClone(stored);
  }

  async findByIdempotencyKey({ organizationId, projectId, idempotencyKey }) {
    return [...this.executions.values()].find((item) =>
      item.organizationId === organizationId &&
      item.projectId === projectId &&
      item.idempotencyKey === idempotencyKey,
    ) || null;
  }

  async getExecution(id) {
    const value = this.executions.get(id);
    return value ? structuredClone(value) : null;
  }

  async updateExecution(id, patch, expectedStatusVersion) {
    const current = this.executions.get(id);
    assert.ok(current, "execution must exist");
    if (expectedStatusVersion !== undefined) {
      assert.equal(
        current.statusVersion,
        expectedStatusVersion,
        "optimistic status version must match",
      );
    }
    const updated = { ...current, ...structuredClone(patch) };
    this.executions.set(id, updated);
    return structuredClone(updated);
  }

  async appendEvent(event) {
    const stored = structuredClone(event);
    if (stored.sequence === undefined) {
      stored.sequence = this.events.filter((item) => item.executionId === stored.executionId).length + 1;
    }
    this.events.push(stored);
    return structuredClone(stored);
  }

  async nextEventSequence(executionId) {
    return this.events.filter((item) => item.executionId === executionId).length + 1;
  }

  async listExecutionsByStatus(statuses) {
    const accepted = new Set(statuses);
    return [...this.executions.values()]
      .filter((item) => accepted.has(item.status))
      .map(structuredClone);
  }
}

function createClock() {
  let value = Date.parse("2026-08-20T00:00:00.000Z");
  return () => new Date((value += 1_000));
}

function artifact(type = "ROBOT_OUTPUT_XML", text = "<robot status=\"PASS\" />") {
  const bytes = Buffer.from(text, "utf8");
  return {
    type,
    fileName: type === "SCREEN_RECORDING" ? "recording.mp4" : "output.xml",
    contentType: type === "SCREEN_RECORDING" ? "video/mp4" : "application/xml",
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
  };
}

function runtimeProof(clock, platform = "WINDOWS") {
  const checkedAt = clock().toISOString();
  return {
    ready: true,
    realExecution: true,
    simulated: false,
    desktopExecution: platform !== "ANDROID",
    runtimeOs: platform === "WINDOWS" ? "Windows" : platform,
    checkedAt,
    driverSession: {
      ready: true,
      sessionCreated: true,
      sessionId: "session-real-1",
      lastVerifiedAt: checkedAt,
    },
  };
}

function command(overrides = {}) {
  return {
    organizationId: "org-1",
    projectId: "project-1",
    platform: "WINDOWS",
    idempotencyKey: `idem-${crypto.randomUUID()}`,
    package: {
      files: [{ path: "suite.robot", sha256: "a".repeat(64) }],
      expectedResult: "The user can complete the workflow.",
    },
    target: { id: "windows-target-1", capabilities: ["WINDOWS_DESKTOP", "ROBOT"] },
    ...overrides,
  };
}

test("central Windows proof rejects non-interactive or uncontrolled execution", () => {
  const base = {
    platform: "WINDOWS",
    realExecution: true,
    simulated: false,
    desktopExecution: true,
    interactiveDesktop: true,
    applicationControlled: true,
    sessionCreated: true,
    robotExitCode: 0,
    meaningfulActionsExecuted: true,
    meaningfulActions: 1,
    meaningfulAssertionsExecuted: true,
    meaningfulAssertions: 1,
    artifacts: [],
  };
  assert.throws(
    () => validateExecutionResult({ ...base, interactiveDesktop: false }),
    (error) => error.code === "INTERACTIVE_DESKTOP_REQUIRED",
  );
  assert.throws(
    () => validateExecutionResult({ ...base, applicationControlled: false }),
    (error) => error.code === "APPLICATION_CONTROL_REQUIRED",
  );
});

function createHarness({ execute, checkRuntime, repairEngine, defectService } = {}) {
  const repository = new InMemoryRepository();
  const clock = createClock();
  const persistedArtifacts = [];
  const adapter = {
    async validatePackage() {
      return {
        valid: true,
        packageBytes: 1024,
        meaningfulActions: 2,
        meaningfulAssertions: 1,
        warnings: [],
      };
    },
    async checkRuntime() {
      return checkRuntime ? checkRuntime(clock) : runtimeProof(clock);
    },
    async execute(context) {
      if (execute) return execute(context);
      return {
        platform: "WINDOWS",
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        interactiveDesktop: true,
        applicationControlled: true,
        sessionCreated: true,
        robotExitCode: 0,
        meaningfulActionsExecuted: true,
        meaningfulActions: 2,
        meaningfulAssertionsExecuted: true,
        meaningfulAssertions: 1,
        artifacts: [artifact()],
      };
    },
    async cancel() {},
  };
  const orchestrator = new ExecutionLifecycleOrchestrator({
    repository,
    adapterRegistry: { async resolve() { return adapter; } },
    artifactStore: {
      async persist(input) {
        const stored = {
          id: `artifact-${persistedArtifacts.length + 1}`,
          ...input,
          artifact: undefined,
        };
        persistedArtifacts.push({ ...stored, artifact: input.artifact });
        return stored;
      },
    },
    repairEngine,
    defectService,
    clock,
    idGenerator: (() => {
      let value = 0;
      return () => `generated-${++value}`;
    })(),
    maxRepairAttempts: 3,
    runtimeProofMaximumAgeMs: 5 * 60 * 1000,
    requiredArtifactTypes: { WINDOWS: ["ROBOT_OUTPUT_XML"] },
  });
  return { repository, orchestrator, persistedArtifacts, clock };
}

test("state machine rejects transitions out of terminal states", () => {
  assert.throws(
    () => assertTransition(EXECUTION_STATUS.PASSED, EXECUTION_STATUS.RUNNING),
    InvalidExecutionTransitionError,
  );
});

test("idempotent create returns the existing durable execution", async () => {
  const { orchestrator, repository } = createHarness();
  const request = command({ idempotencyKey: "same-key" });
  const first = await orchestrator.createExecution(request, { userId: "user-1" });
  const second = await orchestrator.createExecution(request, { userId: "user-1" });
  assert.equal(second.id, first.id);
  assert.equal(repository.executions.size, 1);
});

test("real Windows execution passes only with actions, assertions, session proof, and artifacts", async () => {
  const { orchestrator, repository, persistedArtifacts } = createHarness();
  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const result = await orchestrator.run(created.id);

  assert.equal(result.status, EXECUTION_STATUS.PASSED);
  assert.equal(result.resultProof.realExecution, true);
  assert.equal(result.resultProof.simulated, false);
  assert.equal(result.resultProof.meaningfulActions, 2);
  assert.equal(result.resultProof.meaningfulAssertions, 1);
  assert.equal(persistedArtifacts.length, 1);
  assert.ok(repository.events.some((event) => event.type === "RUNTIME_PROOF_VERIFIED"));
  assert.ok(repository.events.some((event) => event.type === "EXECUTION_PASSED"));
});

test("simulated success is rejected and can never become PASS", async () => {
  const { orchestrator } = createHarness({
    async execute() {
      return {
        platform: "WINDOWS",
        realExecution: true,
        simulated: true,
        desktopExecution: true,
        interactiveDesktop: true,
        applicationControlled: true,
        sessionCreated: true,
        robotExitCode: 0,
        meaningfulActionsExecuted: true,
        meaningfulActions: 3,
        meaningfulAssertionsExecuted: true,
        meaningfulAssertions: 2,
        artifacts: [artifact()],
      };
    },
  });
  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const result = await orchestrator.run(created.id);
  assert.equal(result.status, EXECUTION_STATUS.FAILED);
  assert.notEqual(result.status, EXECUTION_STATUS.PASSED);
  assert.equal(result.failureCode, "SIMULATED_RESULT_REJECTED");
});

test("runtime infrastructure failure is BLOCKED rather than falsely passed", async () => {
  const { orchestrator } = createHarness({
    checkRuntime(clock) {
      return {
        ready: false,
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        runtimeOs: "Windows",
        checkedAt: clock().toISOString(),
        errors: ["APPIUM_STATUS_FAILED"],
      };
    },
  });
  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const result = await orchestrator.run(created.id);
  assert.equal(result.status, EXECUTION_STATUS.BLOCKED);
  assert.notEqual(result.status, EXECUTION_STATUS.PASSED);
});

test("locator failure receives one bounded safe repair and creates a new rerun attempt", async () => {
  let executions = 0;
  const repairEngine = {
    async propose({ package: originalPackage }) {
      return {
        summary: "Replace the stale automation-id locator with a verified semantic locator.",
        updatedPackage: {
          ...originalPackage,
          locatorVersion: 2,
        },
        beforeMeaningfulActions: 2,
        afterMeaningfulActions: 2,
        beforeMeaningfulAssertions: 1,
        afterMeaningfulAssertions: 1,
      };
    },
  };
  const { orchestrator, repository } = createHarness({
    repairEngine,
    async execute() {
      executions += 1;
      if (executions === 1) {
        return {
          platform: "WINDOWS",
          realExecution: true,
          simulated: false,
          desktopExecution: true,
          interactiveDesktop: true,
          applicationControlled: true,
          sessionCreated: true,
          robotExitCode: 1,
          meaningfulActionsExecuted: true,
          meaningfulActions: 1,
          meaningfulAssertionsExecuted: false,
          meaningfulAssertions: 0,
          failureClassification: "LOCATOR_FAILURE",
          failureMessage: "Element locator did not match.",
          artifacts: [artifact()],
        };
      }
      return {
        platform: "WINDOWS",
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        interactiveDesktop: true,
        applicationControlled: true,
        sessionCreated: true,
        robotExitCode: 0,
        meaningfulActionsExecuted: true,
        meaningfulActions: 2,
        meaningfulAssertionsExecuted: true,
        meaningfulAssertions: 1,
        artifacts: [artifact()],
      };
    },
  });

  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const result = await orchestrator.run(created.id);
  assert.equal(result.status, EXECUTION_STATUS.PASSED);
  assert.equal(result.repairAttempts, 1);
  assert.equal(result.attemptNumber, 2);
  assert.equal(executions, 2);
  assert.ok(repository.events.some((event) => event.type === "AUTOMATION_REPAIR_APPLIED"));
  assert.ok(repository.events.some((event) => event.type === "EXECUTION_RERUN_QUEUED"));
});

test("product or assertion failure creates a defect and is never auto-repaired", async () => {
  let defectInput;
  let repairCalls = 0;
  const { orchestrator } = createHarness({
    defectService: {
      async create(input) {
        defectInput = input;
        return { id: "defect-1" };
      },
    },
    repairEngine: {
      async propose() {
        repairCalls += 1;
        throw new Error("must not be called");
      },
    },
    async execute() {
      return {
        platform: "WINDOWS",
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        interactiveDesktop: true,
        applicationControlled: true,
        sessionCreated: true,
        robotExitCode: 1,
        meaningfulActionsExecuted: true,
        meaningfulActions: 2,
        meaningfulAssertionsExecuted: false,
        meaningfulAssertions: 0,
        failureClassification: "PRODUCT_DEFECT",
        failureMessage: "The application returned an incorrect business result.",
        artifacts: [artifact(), artifact("SCREEN_RECORDING", "recording-proof")],
      };
    },
  });

  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const result = await orchestrator.run(created.id);
  assert.equal(result.status, EXECUTION_STATUS.FAILED);
  assert.equal(result.defectId, "defect-1");
  assert.equal(repairCalls, 0);
  assert.equal(defectInput.executionId, created.id);
  assert.equal(defectInput.classification, "PRODUCT_DEFECT");
  assert.equal(defectInput.artifacts.length, 2);
});

test("cancellation is durable and terminal", async () => {
  const { orchestrator } = createHarness();
  const created = await orchestrator.createExecution(command(), { userId: "user-1" });
  const requested = await orchestrator.requestCancellation(created.id, { userId: "user-2" });
  assert.equal(requested.status, EXECUTION_STATUS.CANCEL_REQUESTED);
  const result = await orchestrator.run(created.id);
  assert.equal(result.status, EXECUTION_STATUS.CANCELLED);
  assert.equal(result.cancelRequested, true);
});
