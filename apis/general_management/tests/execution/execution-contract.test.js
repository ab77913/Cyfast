"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RUN_STATES,
  FAILURE_CLASSES,
  assertTransition,
  validateTarget,
  validateRealPass,
  classifyFailure,
  validateRepair,
  validatePackagePath,
  redactSecrets,
} = require("../../services/execution/execution-contract");

test("state machine permits only explicit transitions", () => {
  assert.equal(assertTransition(RUN_STATES.CREATED, RUN_STATES.VALIDATING), RUN_STATES.VALIDATING);
  assert.throws(() => assertTransition(RUN_STATES.CREATED, RUN_STATES.PASSED), /cannot transition/);
});

test("Windows target requires an interactive capability", () => {
  const invalid = validateTarget({ name: "Win-1", platform: "windows", capabilities: ["windows_robot"], configuration: {} });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /interactive_desktop/);

  const valid = validateTarget({
    name: "Win-1",
    platform: "windows",
    status: "READY",
    capabilities: ["windows_robot", "interactive_desktop"],
    configuration: {},
    credential_reference: "CYFAST_WINDOWS_TOKEN",
  });
  assert.equal(valid.valid, true);
});

test("Android target requires a device selector", () => {
  const result = validateTarget({ name: "Pixel", platform: "ANDROID", capabilities: ["adb"], configuration: {} });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /device_id|device_selector/);
});

test("Embedded target requires protocol capability and interface reference", () => {
  const invalid = validateTarget({
    name: "CAN bench",
    platform: "EMBEDDED",
    capabilities: ["uart"],
    configuration: { protocol: "can" },
  });
  assert.equal(invalid.valid, false);

  const valid = validateTarget({
    name: "CAN bench",
    platform: "EMBEDDED",
    capabilities: ["can"],
    configuration: { protocol: "CAN", interface_reference: "VECTOR_CAN_1" },
  });
  assert.equal(valid.valid, true);
});

test("truthful PASS requires real execution, actions, assertions, and evidence", () => {
  const result = validateRealPass({
    platform: "WINDOWS",
    status: "PASSED",
    real_execution: true,
    simulated: false,
    target_connected: true,
    session_created: true,
    exit_code: 0,
    meaningful_actions: 3,
    meaningful_assertions: 2,
    evidence: [
      { type: "execution_log" },
      { type: "output_xml" },
      { type: "screenshot" },
      { type: "runtime_proof" },
    ],
  });
  assert.equal(result.pass, true);
  assert.equal(result.proof_hash.length, 64);

  const fake = validateRealPass({
    platform: "WINDOWS",
    status: "PASSED",
    real_execution: false,
    simulated: true,
    target_connected: false,
    session_created: false,
    exit_code: 0,
    meaningful_actions: 0,
    meaningful_assertions: 0,
    evidence: [],
  });
  assert.equal(fake.pass, false);
  assert.ok(fake.errors.length >= 7);
});

test("assertion failures are classified before locator text", () => {
  assert.equal(
    classifyFailure({ message: "Element should be visible but assertion failed; locator resolved" }),
    FAILURE_CLASSES.ASSERTION_FAILURE,
  );
});

test("environment and target failures do not trigger script repair", () => {
  assert.equal(classifyFailure({ agent_online: false }), FAILURE_CLASSES.TARGET_UNAVAILABLE);
  const repair = validateRepair({
    failure_classification: FAILURE_CLASSES.TARGET_UNAVAILABLE,
    attempt_number: 1,
    before_script: "Click Button    save\nElement Should Be Visible    success",
    after_script: "Click Button    save\nElement Should Be Visible    success",
  });
  assert.equal(repair.valid, false);
});

test("repair may not delete assertions or business actions", () => {
  const repair = validateRepair({
    failure_classification: FAILURE_CLASSES.LOCATOR_FAILURE,
    attempt_number: 1,
    before_script: "Click Button    save\nElement Should Be Visible    success",
    after_script: "Log    PASS",
    diff_summary: "replace failing test",
  });
  assert.equal(repair.valid, false);
  assert.match(repair.errors.join(" "), /assertions|business actions|fabricated PASS/);
});

test("safe package paths reject traversal and absolute paths", () => {
  assert.equal(validatePackagePath("resources/login.resource"), "resources/login.resource");
  assert.throws(() => validatePackagePath("../secret.txt"), /Unsafe package path/);
  assert.throws(() => validatePackagePath("C:\\secret.txt"), /Absolute package path/);
  assert.throws(() => validatePackagePath("/tmp/test.robot"), /Absolute package path/);
});

test("secret redaction is recursive", () => {
  assert.deepEqual(
    redactSecrets({ username: "user", password: "p", nested: { api_key: "k", value: 3 } }),
    { username: "user", password: "[REDACTED]", nested: { api_key: "[REDACTED]", value: 3 } },
  );
});
