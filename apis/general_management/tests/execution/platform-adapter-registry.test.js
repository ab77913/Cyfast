"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PlatformAdapterRegistry,
  HttpPlatformAdapter,
  RoutedPlatformAdapter,
  validateEndpoint,
  validateExecutionRequest,
} = require("../../services/execution/platform-adapter-registry");
const {
  WindowsOutboundPlatformAdapter,
  normalizeRobotResult,
  toRobotPackage,
} = require("../../services/execution/windows-outbound-platform-adapter");

function target(platform, overrides = {}) {
  const values = {
    WINDOWS: { capabilities: ["windows_robot", "interactive_desktop"], configuration: {} },
    LINUX: { capabilities: ["linux_robot"], configuration: {} },
    ANDROID: { capabilities: ["android_appium"], configuration: { device_id: "emulator-5554" } },
    EMBEDDED: { capabilities: ["can"], configuration: { protocol: "can", interface_reference: "CAN-1" } },
  };
  return {
    execution_target_id: "target-1",
    name: `${platform} target`,
    platform,
    status: "READY",
    endpoint: "https://agent.example.test",
    credential_reference: "CYFAST_TARGET_TOKEN",
    ...values[platform],
    ...overrides,
  };
}

test("registry rejects malformed adapters and duplicates", () => {
  const registry = new PlatformAdapterRegistry();
  assert.throws(() => registry.register({ platform: "WINDOWS" }), /check\(\), and execute/);
  const adapter = { platform: "WINDOWS", check() {}, execute() {} };
  registry.register(adapter);
  assert.equal(registry.get("windows"), adapter);
  assert.throws(() => registry.register(adapter), /already registered/);
});

test("endpoint validation requires HTTPS except explicit loopback", () => {
  assert.equal(validateEndpoint("https://agent.example.test", true), "https://agent.example.test/");
  assert.equal(validateEndpoint("http://127.0.0.1:8095", true), "http://127.0.0.1:8095/");
  assert.throws(() => validateEndpoint("http://agent.example.test", true), /HTTPS is required/);
  assert.throws(() => validateEndpoint("https://user:pass@agent.example.test", true), /Credentials may not be embedded/);
  assert.throws(() => validateEndpoint("https://agent.example.test/custom", true), /must not include a custom request path/);
});

test("execution request cannot select arbitrary executable or shell", () => {
  const valid = { execution_id: "run_1", package: { files: [{ path: "suite.robot", content_base64: "AA==" }] } };
  assert.doesNotThrow(() => validateExecutionRequest(valid));
  assert.throws(() => validateExecutionRequest({ ...valid, shell: "powershell" }), /may not select/);
});

test("adapter uses fixed platform paths and secret reference", async () => {
  const calls = [];
  const transport = {
    async request(config) {
      calls.push(config);
      return { data: { ready: true } };
    },
  };
  const adapter = new HttpPlatformAdapter({
    platform: "ANDROID",
    transport,
    tokenResolver: async (reference) => reference === "CYFAST_TARGET_TOKEN" ? "secret-value" : null,
  });
  const response = await adapter.check(target("ANDROID"), { correlation_id: "corr-1" });
  assert.equal(response.ready, true);
  assert.equal(calls[0].url, "https://agent.example.test/v1/android/runtime/check");
  assert.equal(calls[0].headers.authorization, "Bearer secret-value");
  assert.equal(calls[0].data.configuration.device_id, "emulator-5554");
});

test("adapter validates each platform before transport is called", async () => {
  let calls = 0;
  const adapter = new HttpPlatformAdapter({
    platform: "EMBEDDED",
    transport: { async request() { calls += 1; return { data: {} }; } },
    tokenResolver: async () => "token",
  });
  await assert.rejects(
    () => adapter.check(target("EMBEDDED", { capabilities: ["uart"], configuration: { protocol: "can" } })),
    /does not advertise can|interface_reference/,
  );
  assert.equal(calls, 0);
});

test("Windows adapter routes outbound targets without accepting a public agent endpoint", async () => {
  const calls = [];
  const direct = { assertTarget() { calls.push("direct-assert"); }, check() { calls.push("direct-check"); } };
  const outbound = { assertTarget() { calls.push("outbound-assert"); }, check() { calls.push("outbound-check"); } };
  const adapter = new RoutedPlatformAdapter("WINDOWS", direct, outbound);
  const outboundTarget = { configuration: { transport: "OUTBOUND_AGENT" } };
  adapter.assertTarget(outboundTarget);
  await adapter.check(outboundTarget);
  assert.deepEqual(calls, ["outbound-assert", "outbound-check"]);
});

test("first-party Windows targets require an application-bound session and reject public ports", () => {
  const adapter = new WindowsOutboundPlatformAdapter({
    sessions: {}, model() {}, publish() {}, sleep: async () => {},
  });
  const base = {
    endpoint: "outbound://windows-agent",
    configuration: {
      transport: "OUTBOUND_AGENT",
      interactive_session_id: "session-1",
      application_profile_id: "profile-1",
    },
  };
  assert.doesNotThrow(() => adapter.assertTarget(base));
  assert.throws(
    () => adapter.assertTarget({ ...base, endpoint: "https://desktop.example.test:4723" }),
    /must not expose an agent HTTP endpoint/,
  );
  assert.throws(
    () => adapter.assertTarget({ ...base, configuration: { ...base.configuration, application_profile_id: "" } }),
    /application_profile_id/,
  );
});

test("outbound Windows package and proof normalization preserve deterministic evidence", () => {
  const packageValue = toRobotPackage({
    execution_id: "run-1",
    timeout_seconds: 60,
    runtime: { environment_references: { PASSWORD: "CYFAST_HMS_PASSWORD" } },
    package: {
      suite_path: "suite.robot",
      files: [{ path: "suite.robot", content_base64: "YWJj", sha256: "hash" }],
    },
  });
  assert.equal(packageValue.executionId, "run-1");
  assert.equal(packageValue.files[0].contentBase64, "YWJj");
  assert.equal(packageValue.environmentReferences.PASSWORD, "CYFAST_HMS_PASSWORD");

  const value = Buffer.from("<robot/>");
  const result = normalizeRobotResult({
    Status: "PASSED",
    RealExecution: true,
    Simulated: false,
    DesktopExecution: true,
    SessionCreated: true,
    RobotExitCode: 0,
    MeaningfulActions: 1,
    MeaningfulAssertions: 1,
    RuntimeProofSessionId: "session-1",
    Artifacts: [{
      Type: "ROBOT_OUTPUT_XML",
      FileName: "output.xml",
      ContentType: "application/xml",
      Size: value.length,
      Sha256: cryptoHash(value),
      ContentBase64: value.toString("base64"),
    }],
  });
  assert.equal(result.real_execution, true);
  assert.equal(result.artifacts[0].type, "output_xml");
  assert.ok(result.artifacts.some((artifact) => artifact.type === "runtime_proof"));
});

function cryptoHash(value) {
  return require("crypto").createHash("sha256").update(value).digest("hex");
}
