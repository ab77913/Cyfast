"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.WINDOWS_ENROLLMENT_PEPPER = "test-pepper";
delete process.env.WINDOWS_AUTOMATION_ENABLED;

const { hash, safeEqual } = require("../../services/windows/enrollment-service");
const {
  validateCommandEnvelope,
  payloadHash,
  mapActionToCommandType,
  ALLOWED_COMMANDS,
} = require("../../services/windows/command-envelope");
const { isWindowsAutomationEnabled } = require("../../services/windows/feature-flag");
const {
  getInternalApiToken,
  assertAgentTransportAllowed,
} = require("../../services/windows/windows-security-config");
const {
  WINDOWS_PERMISSION_CODES,
  createPermissionBootstrap,
} = require("../../services/windows/windows-permission-bootstrap");

test("enrollment hashes include the pepper and compare constant-time", () => {
  const value = hash("token");
  assert.equal(value.length, 64);
  assert.ok(safeEqual(value, hash("token")));
  assert.equal(safeEqual(value, hash("other")), false);
});

test("feature flag defaults off and enables only when true", () => {
  delete process.env.WINDOWS_AUTOMATION_ENABLED;
  assert.equal(isWindowsAutomationEnabled(), false);
  process.env.WINDOWS_AUTOMATION_ENABLED = "true";
  assert.equal(isWindowsAutomationEnabled(), true);
  process.env.WINDOWS_AUTOMATION_ENABLED = "false";
  assert.equal(isWindowsAutomationEnabled(), false);
});

test("missing internal token fails closed in production", () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousToken = process.env.WINDOWS_INTERNAL_API_TOKEN;
  const previousDevSecrets = process.env.WINDOWS_ALLOW_DEV_SECRETS;
  process.env.NODE_ENV = "production";
  delete process.env.WINDOWS_INTERNAL_API_TOKEN;
  delete process.env.WINDOWS_ALLOW_DEV_SECRETS;
  try {
    assert.throws(() => getInternalApiToken(), { code: "CONFIGURATION_ERROR" });
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousToken === undefined) delete process.env.WINDOWS_INTERNAL_API_TOKEN;
    else process.env.WINDOWS_INTERNAL_API_TOKEN = previousToken;
    if (previousDevSecrets === undefined) delete process.env.WINDOWS_ALLOW_DEV_SECRETS;
    else process.env.WINDOWS_ALLOW_DEV_SECRETS = previousDevSecrets;
  }
});

test("insecure agent transport is limited to flagged loopback peers", () => {
  assert.deepEqual(
    assertAgentTransportAllowed({ protocol: "ws", peerHost: "127.0.0.1", allowInsecureFlag: true }),
    { ok: true, mode: "insecure-loopback" }
  );
  assert.throws(
    () => assertAgentTransportAllowed({ protocol: "ws", peerHost: "10.0.0.10", allowInsecureFlag: true }),
    { code: "INSECURE_TRANSPORT_REJECTED" }
  );
  assert.throws(
    () => assertAgentTransportAllowed({ protocol: "ws", peerHost: "127.0.0.1", allowInsecureFlag: false }),
    { code: "INSECURE_TRANSPORT_REJECTED" }
  );
});

test("permission bootstrap exposes all W1 permission codes", () => {
  assert.deepEqual(WINDOWS_PERMISSION_CODES, [
    "windows_agent.enroll",
    "windows_agent.read",
    "windows_agent.manage",
    "windows_session.create",
    "windows_session.control",
    "windows_session.inspect",
    "windows_evidence.read",
    "windows_application_profile.manage",
  ]);
});

test("permission bootstrap scopes inserts and role assignment to organization 42", async () => {
  const calls = [];
  const sequelize = {
    transaction: async (callback) => callback({ id: "test-transaction" }),
    query: async (sql, options) => {
      calls.push({ sql, options });
      if (sql.includes("SELECT permission_id")) {
        return WINDOWS_PERMISSION_CODES.map((name, index) => ({ permission_id: index + 1, name }));
      }
      if (sql.includes("SELECT role_id")) return [{ role_id: 9 }];
      return [{ affectedRows: 1 }];
    },
  };
  const bootstrap = createPermissionBootstrap(() => ({
    db: { sequelize, Sequelize: { QueryTypes: { SELECT: "SELECT" } } },
  }));

  const result = await bootstrap(42);
  assert.equal(result.organizationId, 42);
  assert.equal(result.assigned, WINDOWS_PERMISSION_CODES.length);
  for (const call of calls) {
    assert.equal(call.options.replacements.organizationId, 42);
  }
  const roleAssignments = calls.filter(({ sql }) => sql.includes("INSERT INTO role_permission"));
  assert.equal(roleAssignments.length, WINDOWS_PERMISSION_CODES.length);
  assert.ok(roleAssignments.every((call) => call.options.replacements.roleId === 9));
});

test("W1 migration does not seed fixed organization permissions", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../../../../databases/MYSQL/cyfast2/2.0.0/09_windows_connect_w1.sql"),
    "utf8"
  );
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+(?:permission|role_permission)[\s\S]*?organization_id\s*=\s*1/i);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+(?:permission|role_permission)[\s\S]*?\b(?:organization_id|role_id)\s*,?\s*1/i);
});

test("durable Windows commands persist execution correlation, attempts, and replay-safe results", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../../../../databases/MYSQL/cyfast2/2.0.0/26_windows_durable_command_extensions.sql"),
    "utf8"
  );
  assert.match(migration, /project_id INT NULL/);
  assert.match(migration, /execution_id VARCHAR\(64\) NULL/);
  assert.match(migration, /attempt_count INT NOT NULL DEFAULT 0/);
  assert.match(migration, /result JSON NULL/);
  assert.match(migration, /UNIQUE KEY uq_ecr_command_org/);
});

test("W1 stable stack does not replay schema migrations already present in 01_schema", () => {
  const runner = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/windows/start-w1-stack.ps1"),
    "utf8"
  );
  assert.match(runner, /\^\(08\|09\|10\|26\)_/);
  assert.doesNotMatch(runner, /\^\(04\|05\|06\|07\|08\|09\|10\)_/);
});

test("W1 stable stack supports Windows PowerShell 5.1 process arguments", () => {
  const runner = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/windows/start-w1-stack.ps1"),
    "utf8"
  );
  assert.match(runner, /Start-Process -FilePath \$Command -ArgumentList \$Arguments/);
  assert.match(runner, /-RedirectStandardOutput \$log -RedirectStandardError \$errorLog/);
  assert.doesNotMatch(runner, /BeginOutputReadLine|add_OutputDataReceived/);
});

test("W1 stable stack configures required MongoDB and idempotent tracked shutdown", () => {
  const runner = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/windows/start-w1-stack.ps1"),
    "utf8"
  );
  const stop = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/windows/stop-w1-stack.ps1"),
    "utf8"
  );
  assert.match(runner, /general_management'; path = 'apis\\general_management'; environment = @\{ DATABASE_TYPE_SECONDARY = 'mongodb' \}/);
  assert.match(runner, /DATABASE_TYPE_SECONDARY = ''/);
  assert.match(stop, /Stop-Process -Id \$entry\.pid -Force -ErrorAction SilentlyContinue/);
});

test("W1 final readiness checks cannot terminate the orchestrator process", () => {
  const runner = fs.readFileSync(
    path.resolve(__dirname, "../../../../scripts/windows/run-w1-final-readiness.ps1"),
    "utf8"
  );
  const checks = runner.slice(runner.indexOf("Push-Location $root"), runner.indexOf("$mandatory ="));
  assert.doesNotMatch(checks, /\bexit\s+(?:\$LASTEXITCODE|\$code|0)\b/);
  assert.match(checks, /\$LASTEXITCODE -eq 2[^\n]+BLOCKED/);
});

test("command envelope allows windows.* allowlist commands", () => {
  for (const command_type of ALLOWED_COMMANDS) {
    const result = validateCommandEnvelope({
      command_type,
      agent_id: "agent-1",
      idempotency_key: `idemp-${command_type}`,
      correlation_id: "corr-1",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      payload: { ok: true },
      organization_id: 1,
    });
    assert.equal(result.command_type, command_type);
    assert.equal(result.payload_hash, payloadHash({ ok: true }));
  }
});

test("command envelope rejects unknown, forbidden, expired, and bad schema", () => {
  assert.throws(
    () =>
      validateCommandEnvelope({
        command_type: "bad",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(Date.now() + 1000).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_NOT_ALLOWED" }
  );
  assert.throws(
    () =>
      validateCommandEnvelope({
        command_type: "windows.shell",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(Date.now() + 1000).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_REJECTED" }
  );
  assert.throws(
    () =>
      validateCommandEnvelope({
        command_type: "windows.health",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(Date.now() - 1000).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_EXPIRED" }
  );
  assert.throws(
    () =>
      validateCommandEnvelope({
        schema_version: "2.0",
        command_type: "windows.health",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(Date.now() + 1000).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_INVALID" }
  );
});

test("UI actions map to windows command types", () => {
  assert.equal(mapActionToCommandType("launch", {}), "windows.launch_profile");
  assert.equal(mapActionToCommandType("inspect", {}), "windows.inspect_ui");
  assert.equal(mapActionToCommandType("actions", { action: "set_value" }), "windows.set_element_value");
  assert.equal(mapActionToCommandType("actions", { action: "select" }), "windows.select_element");
  assert.equal(mapActionToCommandType("screenshots", {}), "windows.capture_screenshot");
  assert.equal(mapActionToCommandType("end", {}), "windows.end_session");
  assert.equal(mapActionToCommandType("check_runtime", {}), "windows.check_runtime");
  assert.equal(mapActionToCommandType("recover_runtime", {}), "windows.recover_runtime");
  assert.equal(mapActionToCommandType("validate_robot_package", {}), "windows.validate_robot_package");
  assert.equal(mapActionToCommandType("start_robot_job", {}), "windows.start_robot_job");
  assert.equal(mapActionToCommandType("get_robot_job_status", {}), "windows.get_robot_job_status");
  assert.equal(mapActionToCommandType("cancel_robot_job", {}), "windows.cancel_robot_job");
  assert.equal(mapActionToCommandType("collect_robot_job_result", {}), "windows.collect_robot_job_result");
});

test("payload hash is deterministic", () => {
  assert.equal(payloadHash({ a: 1 }), payloadHash({ a: 1 }));
  assert.notEqual(payloadHash({ a: 1 }), payloadHash({ a: 2 }));
});

test("application profiles reject traversal and UNC by default", () => {
  const profiles = require("../../services/windows/windows-profile-validation");
  assert.throws(
    () => profiles.assertSafeExecutablePath("C:\\temp\\..\\Windows\\System32\\cmd.exe"),
    { code: "APPLICATION_NOT_APPROVED" }
  );
  assert.throws(
    () => profiles.assertSafeExecutablePath("\\\\server\\share\\app.exe"),
    { code: "APPLICATION_NOT_APPROVED" }
  );
  profiles.assertSafeExecutablePath("C:\\Apps\\CyFast.Windows.TestFixture.exe");
});

test("mandatory evidence map requires screenshot and inspect artifacts", () => {
  const {
    requiredEvidenceFor,
    extractEvidenceParts,
    COMMAND_STATES,
    isTerminalStatus,
  } = require("../../services/windows/windows-command-lifecycle");
  assert.ok(requiredEvidenceFor("windows.capture_screenshot").includes("screenshot"));
  assert.ok(requiredEvidenceFor("windows.inspect_ui").includes("ui_hierarchy_json"));
  assert.equal(isTerminalStatus(COMMAND_STATES.COMPLETED), true);
  assert.equal(isTerminalStatus(COMMAND_STATES.EVIDENCE_PENDING), false);
  const shot = extractEvidenceParts("windows.capture_screenshot", {
    Payload: { contentType: "image/png", data: Buffer.from("abc").toString("base64"), sha256: require("../../services/windows/windows-evidence-service").hash(Buffer.from("abc")) },
  });
  assert.ok(shot.some((p) => p.type === "screenshot"));
  const tree = extractEvidenceParts("windows.inspect_ui", { Payload: { roots: [{ id: "x" }] } });
  assert.ok(tree.some((p) => p.type === "ui_hierarchy_json"));
});

test("invalid evidence hash is detected before storage", () => {
  const { extractEvidenceParts } = require("../../services/windows/windows-command-lifecycle");
  const parts = extractEvidenceParts("windows.capture_screenshot", {
    Payload: { data: Buffer.from("abc").toString("base64"), sha256: "deadbeef" },
  });
  const shot = parts.find((p) => p.type === "screenshot");
  assert.ok(shot.expectedHash === "deadbeef");
});

test("action commands require post-action evidence parts", () => {
  const { requiredEvidenceFor, extractEvidenceParts } = require("../../services/windows/windows-command-lifecycle");
  for (const type of ["windows.invoke_element", "windows.set_element_value", "windows.select_element"]) {
    const required = requiredEvidenceFor(type);
    assert.ok(required.includes("action_result_metadata"));
    assert.ok(required.includes("post_action_ui_snapshot"));
    const parts = extractEvidenceParts(type, { Payload: { automationId: "btn" } });
    assert.ok(parts.some((p) => p.type === "resolved_element_metadata"));
  }
});

test("launch and end_session mandatory evidence extractors are present", () => {
  const { extractEvidenceParts, requiredEvidenceFor } = require("../../services/windows/windows-command-lifecycle");
  assert.deepEqual(requiredEvidenceFor("windows.launch_profile").sort(), ["launch_result", "process_application_metadata"].sort());
  assert.ok(extractEvidenceParts("windows.launch_profile", { Payload: { processId: 1 } }).length >= 2);
  assert.ok(extractEvidenceParts("windows.end_session", { Payload: { ended: true } }).length >= 2);
});

test("Robot result collection requires and extracts centrally stored proof artifacts", () => {
  const { extractEvidenceParts, requiredEvidenceFor } = require("../../services/windows/windows-command-lifecycle");
  const artifact = (type, fileName, value) => ({
    Type: type,
    FileName: fileName,
    ContentType: "text/plain",
    ContentBase64: Buffer.from(value).toString("base64"),
    Sha256: require("../../services/windows/windows-evidence-service").hash(Buffer.from(value)),
  });
  const required = requiredEvidenceFor("windows.collect_robot_job_result");
  assert.ok(required.includes("robot_output_xml"));
  assert.ok(required.includes("robot_execution_proof"));
  const parts = extractEvidenceParts("windows.collect_robot_job_result", {
    Payload: {
      RealExecution: true,
      Simulated: false,
      DesktopExecution: true,
      SessionCreated: true,
      RobotExitCode: 0,
      MeaningfulActions: 1,
      MeaningfulAssertions: 1,
      Artifacts: [
        artifact("ROBOT_OUTPUT_XML", "output.xml", "output"),
        artifact("ROBOT_LOG_HTML", "log.html", "log"),
        artifact("ROBOT_REPORT_HTML", "report.html", "report"),
        artifact("STDOUT", "stdout.log", "stdout"),
        artifact("STDERR", "stderr.log", "stderr"),
      ],
    },
  });
  assert.deepEqual(new Set(parts.map((part) => part.type)), new Set(required));
});

test("completed is terminal and evidence-pending is not", () => {
  const { isTerminalStatus, COMMAND_STATES } = require("../../services/windows/windows-command-lifecycle");
  assert.equal(isTerminalStatus(COMMAND_STATES.EVIDENCE_FAILED), true);
  assert.equal(isTerminalStatus(COMMAND_STATES.EXPIRED), true);
  assert.equal(isTerminalStatus(COMMAND_STATES.EVIDENCE_UPLOADING), false);
});
