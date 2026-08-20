"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createExecutionLifecycle } = require("../../services/execution/execution-lifecycle-service");
const { RUN_STATES, FAILURE_CLASSES } = require("../../services/execution/execution-contract");

function createHarness({ health = { ready: true, status: "READY" }, result } = {}) {
  const target = {
    execution_target_id: "target-1",
    organization_id: 1,
    project_id: 2,
    name: "Windows target",
    platform: "WINDOWS",
    endpoint: "https://agent.example.test",
    credential_reference: "TOKEN_REF",
    status: "READY",
    capabilities: ["windows_robot", "interactive_desktop"],
    configuration: {},
    toJSON() { return { ...this, toJSON: undefined }; },
  };
  const runs = new Map();
  const events = [];
  const defects = [];
  const repairs = [];
  const artifacts = [];
  let sequence = 0;

  const store = {
    db: {},
    async getTarget(id) { return id === target.execution_target_id ? target : null; },
    async updateTargetHealth(id, actor, value) { target.status = value.status || (value.ready ? "READY" : "DEGRADED"); target.last_health = value; return target; },
    async createRun(input, actor) {
      const existing = [...runs.values()].find((item) => item.idempotency_key === input.idempotency_key);
      if (existing) return { run: existing, created: false };
      const id = `run-${runs.size + 1}`;
      const run = {
        execution_run_id: id,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
        execution_target_id: input.execution_target_id,
        test_script_id: String(input.test_script_id),
        test_script_version: input.test_script_version,
        parent_execution_run_id: input.parent_execution_run_id || null,
        root_execution_run_id: input.root_execution_run_id || id,
        attempt_number: input.attempt_number || 1,
        platform: input.platform,
        correlation_id: input.correlation_id,
        idempotency_key: input.idempotency_key,
        status: RUN_STATES.CREATED,
      };
      runs.set(id, run);
      return { run, created: true };
    },
    async getRun(id) { return runs.get(id) || null; },
    async transitionRun(id, actor, state, patch = {}, event = {}) {
      const run = runs.get(id);
      Object.assign(run, patch, { status: state });
      events.push({ sequence_number: ++sequence, event_type: event.event_type, status: state, payload: event.payload || {} });
      return run;
    },
    async patchRun(id, actor, patch, eventType) {
      const run = runs.get(id);
      Object.assign(run, patch);
      events.push({ sequence_number: ++sequence, event_type: eventType, payload: patch });
      return run;
    },
    async appendEvent(run, event) { events.push({ sequence_number: ++sequence, ...event }); },
    async createDefect(run, defect) {
      const value = { execution_defect_id: `defect-${defects.length + 1}`, execution_run_id: run.execution_run_id, ...defect };
      defects.push(value);
      return value;
    },
    async listRepairAttempts(runId) { return { items: repairs.filter((item) => item.execution_run_id === runId), pagination: { total: repairs.length } }; },
    async createRepairAttempt(run, repair) {
      const value = { execution_repair_attempt_id: `repair-${repairs.length + 1}`, execution_run_id: run.execution_run_id, ...repair };
      repairs.push(value);
      return value;
    },
    async getRepairAttempt(id) { return repairs.find((item) => item.execution_repair_attempt_id === id) || null; },
    async approveRepairAttempt(id, actor, rerunId) { const item = repairs.find((value) => value.execution_repair_attempt_id === id); item.approval_status = "APPROVED"; item.rerun_execution_run_id = rerunId; return item; },
  };

  const adapter = {
    platform: "WINDOWS",
    assertTarget() {},
    async check() { return health; },
    async execute() { return { execution_id: "external-1", status: "ACCEPTED", ...(result ? { result } : {}) }; },
    async cancel() { return { cancelled: true }; },
  };
  const registry = { get() { return adapter; } };
  const hydrate = async () => ({
    suite_path: "suite.robot",
    files: [{ path: "suite.robot", content_base64: "AA==", sha256: "0".repeat(64), size: 1 }],
    package_sha256: "1".repeat(64),
    manifest: { test_script_version: "1", meaningful_actions: 1, meaningful_assertions: 1 },
  });
  const artifactService = {
    async ingestArtifacts(run, received) {
      const persisted = received.map((item, index) => ({
        execution_artifact_id: `artifact-${artifacts.length + index + 1}`,
        artifact_type: item.type,
        content_hash: item.sha256 || "a".repeat(64),
      }));
      artifacts.push(...persisted);
      const required = ["execution_log", "output_xml", "screenshot", "runtime_proof"];
      const types = new Set(persisted.map((item) => item.artifact_type));
      return { persisted, failures: [], received: [...types], missing: required.filter((type) => !types.has(type)), complete: required.every((type) => types.has(type)) };
    },
  };
  const traceService = {
    async appendTraceLinks() { return []; },
  };

  const lifecycle = createExecutionLifecycle({ store, registry, hydrate, scriptRepository: {}, artifactService, traceService, now: () => new Date("2026-08-20T00:00:00Z") });
  return { lifecycle, store, target, runs, events, defects, repairs, artifacts };
}

function passResult() {
  return {
    platform: "WINDOWS",
    status: "PASSED",
    real_execution: true,
    simulated: false,
    target_connected: true,
    session_created: true,
    exit_code: 0,
    meaningful_actions: 2,
    meaningful_assertions: 2,
    artifacts: [
      { type: "execution_log", sha256: "a".repeat(64) },
      { type: "output_xml", sha256: "b".repeat(64) },
      { type: "screenshot", sha256: "c".repeat(64) },
      { type: "runtime_proof", sha256: "d".repeat(64) },
    ],
  };
}

const actor = { organizationId: 1, projectId: 2, userId: "7" };

test("successful real execution becomes PASSED only after proof and evidence", async () => {
  const harness = createHarness({ result: passResult() });
  const run = await harness.lifecycle.startRun({
    execution_target_id: "target-1",
    test_script_id: 10,
    idempotency_key: "run-success-001",
  }, actor);
  assert.equal(run.status, RUN_STATES.PASSED);
  assert.equal(run.real_execution, true);
  assert.equal(run.simulated, false);
  assert.equal(run.meaningful_assertions, 2);
  assert.equal(run.proof_hash.length, 64);
  assert.ok(harness.events.some((event) => event.event_type === "execution.passed.v1"));
});

test("target readiness failure becomes BLOCKED instead of fake PASS", async () => {
  const harness = createHarness({ health: { ready: false, status: "DEGRADED", error_code: "DEVICE_DISCONNECTED", message: "Device disconnected" } });
  await assert.rejects(
    () => harness.lifecycle.startRun({ execution_target_id: "target-1", test_script_id: 10, idempotency_key: "run-blocked-001" }, actor),
    /Device disconnected/,
  );
  const run = [...harness.runs.values()][0];
  assert.equal(run.status, RUN_STATES.BLOCKED);
  assert.notEqual(run.real_execution, true);
});

test("locator failure creates a defect and enters bounded repair state", async () => {
  const failure = {
    ...passResult(),
    status: "FAILED",
    exit_code: 1,
    meaningful_assertions: 0,
    failure_message: "Unable to locate element with locator id=save",
  };
  const harness = createHarness({ result: failure });
  const run = await harness.lifecycle.startRun({ execution_target_id: "target-1", test_script_id: 10, idempotency_key: "run-repair-001" }, actor);
  assert.equal(run.status, RUN_STATES.REPAIR_PENDING);
  assert.equal(run.failure_classification, FAILURE_CLASSES.LOCATOR_FAILURE);
  assert.equal(harness.defects.length, 1);
});

test("product assertion failure is FAILED and cannot silently alter the script", async () => {
  const failure = {
    ...passResult(),
    status: "FAILED",
    exit_code: 1,
    meaningful_assertions: 0,
    product_behavior_confirmed: true,
    failure_message: "Expected 200 but actual response was 500; assertion failed",
  };
  const harness = createHarness({ result: failure });
  const run = await harness.lifecycle.startRun({ execution_target_id: "target-1", test_script_id: 10, idempotency_key: "run-product-001" }, actor);
  assert.equal(run.status, RUN_STATES.FAILED);
  assert.equal(run.failure_classification, FAILURE_CLASSES.PRODUCT_DEFECT);
  assert.equal(harness.defects[0].severity, "HIGH");
});

test("repair proposal is policy validated and versioned", async () => {
  const failure = {
    ...passResult(),
    status: "FAILED",
    exit_code: 1,
    meaningful_assertions: 0,
    failure_message: "Unable to locate element id=save",
  };
  const harness = createHarness({ result: failure });
  const run = await harness.lifecycle.startRun({ execution_target_id: "target-1", test_script_id: 10, idempotency_key: "run-repair-002" }, actor);
  await assert.rejects(
    () => harness.lifecycle.proposeRepair(run.execution_run_id, {
      before_script: "Click Button    save\nElement Should Be Visible    success",
      after_script: "Log    PASS",
      proposed_patch: "remove failing steps",
    }, actor),
    /may not remove|fabricated PASS/,
  );
  const repair = await harness.lifecycle.proposeRepair(run.execution_run_id, {
    before_script: "Click Button    save\nElement Should Be Visible    success",
    after_script: "Wait Until Element Is Visible    save\nClick Button    save\nElement Should Be Visible    success",
    proposed_patch: "add a bounded semantic wait before the existing action",
    rationale: "The locator resolves after the window transition",
  }, actor);
  assert.equal(repair.attempt_number, 1);
  assert.equal(repair.approval_status, "PENDING");
});
