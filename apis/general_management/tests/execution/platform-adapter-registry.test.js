"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PlatformAdapterRegistry,
  HttpPlatformAdapter,
  validateEndpoint,
  validateExecutionRequest,
} = require("../../services/execution/platform-adapter-registry");

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
