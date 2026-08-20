"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Fastify = require("fastify");
const executionLifecycleRoutes = require("../routes/execution-lifecycle-routes");
const {
  PlatformAdapterRegistry,
  PlatformAdapterRegistryError,
} = require("../services/execution_lifecycle/platform-adapter-registry");
const {
  HttpAgentPlatformAdapter,
  HttpAgentAdapterError,
  sanitizeTarget,
} = require("../services/execution_lifecycle/http-agent-platform-adapter");
const {
  validateArtifact,
  ArtifactStoreError,
} = require("../services/execution_lifecycle/storage-service-artifact-store");
const {
  resolveExecutionScope,
  ExecutionScopeError,
} = require("../services/execution_lifecycle/execution-scope");
const {
  mapRun,
  parseJson,
} = require("../database/mysql/repositories/execution-lifecycle-repository");

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("capability registry resolves only compatible platform adapters", async () => {
  const registry = new PlatformAdapterRegistry();
  registry.register({
    platform: "*",
    capabilities: ["HTTP_AGENT"],
    priority: 10,
    name: "http-agent",
  }, async ({ platform }) => ({ platform }));

  const adapter = await registry.resolve({
    platform: "ANDROID",
    target: { capabilities: ["HTTP_AGENT", "ANDROID"] },
    execution: { packageSnapshot: { requiredCapabilities: ["ANDROID"] } },
  });
  assert.equal(adapter.platform, "ANDROID");

  await assert.rejects(
    registry.resolve({
      platform: "EMBEDDED",
      target: { capabilities: ["HTTP_AGENT"] },
      execution: { packageSnapshot: { requiredCapabilities: ["CAN"] } },
    }),
    (error) => error instanceof PlatformAdapterRegistryError &&
      error.code === "TARGET_CAPABILITY_MISMATCH",
  );
});

test("HTTP agent target rejects inline credentials", () => {
  assert.throws(
    () => sanitizeTarget({
      baseUrl: "http://127.0.0.1:8095",
      credentialRef: "agent-token",
      token: "must-not-be-here",
    }),
    (error) => error instanceof HttpAgentAdapterError &&
      error.code === "INLINE_AGENT_CREDENTIAL_REJECTED",
  );
});

test("HTTP agent adapter validates, checks, executes, polls, and collects a real result", async () => {
  const requests = [];
  let statusPolls = 0;
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), method: init.method, authorization: init.headers.authorization });
    const path = new URL(url).pathname;
    if (path === "/v1/packages/validate") {
      return jsonResponse({
        valid: true,
        packageBytes: 100,
        meaningfulActions: 1,
        meaningfulAssertions: 1,
        errors: [],
        warnings: [],
      });
    }
    if (path === "/v1/runtime/check") {
      return jsonResponse({
        ready: true,
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        runtimeOs: "Windows",
        checkedAt: new Date().toISOString(),
        driverSession: {
          ready: true,
          sessionCreated: true,
          sessionId: "real-session",
          lastVerifiedAt: new Date().toISOString(),
        },
      });
    }
    if (path === "/v1/jobs" && init.method === "POST") {
      return jsonResponse({ jobId: "job-1" }, 202);
    }
    if (path === "/v1/jobs/job-1" && init.method === "GET") {
      statusPolls += 1;
      return jsonResponse({ status: statusPolls > 1 ? "PASSED" : "RUNNING", progress: 50 });
    }
    if (path === "/v1/jobs/job-1/result") {
      return jsonResponse({
        realExecution: true,
        simulated: false,
        desktopExecution: true,
        sessionCreated: true,
        robotExitCode: 0,
        meaningfulActions: 1,
        meaningfulAssertions: 1,
        artifacts: [],
      });
    }
    return jsonResponse({ message: "not found" }, 404);
  };

  const adapter = new HttpAgentPlatformAdapter({
    target: {
      id: "target-1",
      baseUrl: "http://127.0.0.1:8095",
      credentialRef: "windows-agent-token",
      capabilities: ["HTTP_AGENT", "WINDOWS_DESKTOP"],
      pollIntervalMs: 250,
      executionTimeoutMs: 30_000,
    },
    platform: "WINDOWS",
    fetchImpl,
    credentialResolver: async () => "a-secure-server-side-token",
    sleep: async () => {},
  });
  const execution = { id: "execution-1" };
  const validation = await adapter.validatePackage({
    execution,
    package: { files: [] },
    attemptNumber: 1,
  });
  assert.equal(validation.valid, true);
  const proof = await adapter.checkRuntime({ execution, attemptNumber: 1 });
  const events = [];
  const result = await adapter.execute({
    execution,
    package: { files: [] },
    runtimeProof: proof,
    attemptNumber: 1,
    onEvent: async (type, details) => events.push({ type, details }),
  });
  assert.equal(result.status, "PASSED");
  assert.equal(result.agentJobId, "job-1");
  assert.equal(statusPolls, 2);
  assert.ok(events.some((event) => event.details.status === "RUNNING"));
  assert.ok(requests.every((request) => request.authorization === "Bearer a-secure-server-side-token"));
});

test("artifact validation rejects checksum mismatch and accepts canonical proof", () => {
  const bytes = Buffer.from("execution evidence", "utf8");
  const valid = {
    type: "ROBOT_OUTPUT_XML",
    fileName: "output.xml",
    contentType: "application/xml",
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
  };
  assert.equal(validateArtifact(valid, 1024).size, bytes.length);
  assert.throws(
    () => validateArtifact({ ...valid, sha256: "0".repeat(64) }, 1024),
    (error) => error instanceof ArtifactStoreError &&
      error.code === "ARTIFACT_CHECKSUM_MISMATCH",
  );
});

test("execution scope enforces authenticated organization and project membership", () => {
  const request = {
    user: {
      id: "user-1",
      organizationId: "org-1",
      projectIds: ["project-1"],
      roles: ["TESTER"],
    },
    headers: {},
    params: {},
    query: { projectId: "project-1" },
    body: {},
  };
  assert.deepEqual(
    resolveExecutionScope(request),
    {
      organizationId: "org-1",
      projectId: "project-1",
      userId: "user-1",
      roles: ["TESTER"],
      principal: request.user,
    },
  );
  assert.throws(
    () => resolveExecutionScope({
      ...request,
      query: { projectId: "project-2" },
    }),
    (error) => error instanceof ExecutionScopeError &&
      error.code === "PROJECT_SCOPE_FORBIDDEN",
  );
});

test("repository row mapping preserves JSON, booleans, versions, and timestamps", () => {
  assert.deepEqual(parseJson('{"ready":true}'), { ready: true });
  const mapped = mapRun({
    id: "execution-1",
    organization_id: "org-1",
    project_id: "project-1",
    platform: "WINDOWS",
    status: "QUEUED",
    status_version: 3,
    idempotency_key: "idem-1",
    correlation_id: "corr-1",
    requirement_id: null,
    scenario_id: null,
    test_case_id: null,
    test_script_id: null,
    package_snapshot: '{"files":[]}',
    package_sha256: "a".repeat(64),
    target_snapshot: '{"id":"target-1"}',
    target_id: "target-1",
    requested_by: "user-1",
    repair_attempts: 1,
    attempt_number: 2,
    cancel_requested: 1,
    cancel_requested_by: "user-1",
    cancel_requested_at: new Date("2026-08-20T00:00:00Z"),
    runtime_proof: null,
    runtime_proof_verified_at: null,
    result_proof: null,
    last_result: null,
    artifact_count: 2,
    failure_classification: null,
    failure_code: null,
    failure_message: null,
    defect_id: null,
    started_at: new Date("2026-08-20T00:00:01Z"),
    finished_at: null,
    created_at: new Date("2026-08-20T00:00:00Z"),
    updated_at: new Date("2026-08-20T00:00:02Z"),
  });
  assert.equal(mapped.statusVersion, 3);
  assert.equal(mapped.cancelRequested, true);
  assert.deepEqual(mapped.packageSnapshot, { files: [] });
  assert.deepEqual(mapped.targetSnapshot, { id: "target-1" });
});

test("Fastify execution APIs preserve authorized project scope and pagination", async () => {
  const executions = new Map();
  const events = new Map();
  const repository = {
    async getExecution(id, scope) {
      const value = executions.get(id);
      return value && value.organizationId === scope.organizationId && value.projectId === scope.projectId
        ? value
        : null;
    },
    async listExecutions({ organizationId, projectId, page, pageSize }) {
      return {
        items: [...executions.values()].filter((item) =>
          item.organizationId === organizationId && item.projectId === projectId,
        ),
        pagination: { page, pageSize, total: executions.size, totalPages: 1 },
      };
    },
    async listEvents({ executionId, afterSequence }) {
      return (events.get(executionId) || []).filter((event) => event.sequence > afterSequence);
    },
    async listArtifacts() { return []; },
    async getArtifact() { return null; },
  };
  const orchestrator = {
    async start(input, principal) {
      const execution = {
        id: "execution-api-1",
        organizationId: input.organizationId,
        projectId: input.projectId,
        platform: input.platform,
        status: "QUEUED",
        requestedBy: principal.userId,
      };
      executions.set(execution.id, execution);
      events.set(execution.id, [{
        id: "event-1",
        executionId: execution.id,
        sequence: 1,
        type: "EXECUTION_QUEUED",
        status: "QUEUED",
        details: {},
        createdAt: new Date().toISOString(),
      }]);
      return execution;
    },
    async requestCancellation(id) {
      const execution = { ...executions.get(id), status: "CANCEL_REQUESTED" };
      executions.set(id, execution);
      return execution;
    },
  };
  const app = Fastify();
  app.addHook("preHandler", async (request) => {
    request.user = {
      id: "user-1",
      organizationId: "org-1",
      projectIds: ["project-1"],
      roles: ["TESTER"],
    };
  });
  await app.register(executionLifecycleRoutes, {
    repository,
    orchestrator,
    artifactStore: { async getDownloadReference() { return null; } },
  });
  await app.ready();

  const createResponse = await app.inject({
    method: "POST",
    url: "/v1/executions",
    payload: {
      organizationId: "org-1",
      projectId: "project-1",
      platform: "WINDOWS",
      idempotencyKey: "api-idem-1",
      package: { files: [] },
      target: { id: "target-1" },
    },
  });
  assert.equal(createResponse.statusCode, 202, createResponse.body);
  assert.equal(createResponse.json().execution.requestedBy, "user-1");

  const listResponse = await app.inject({
    method: "GET",
    url: "/v1/executions?organizationId=org-1&projectId=project-1&page=1&pageSize=25",
  });
  assert.equal(listResponse.statusCode, 200, listResponse.body);
  assert.equal(listResponse.json().pagination.pageSize, 25);

  const forbidden = await app.inject({
    method: "POST",
    url: "/v1/executions",
    payload: {
      organizationId: "org-1",
      projectId: "project-2",
      platform: "WINDOWS",
      idempotencyKey: "api-idem-2",
      package: { files: [] },
      target: { id: "target-1" },
    },
  });
  assert.equal(forbidden.statusCode, 403, forbidden.body);
  await app.close();
});
