"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const orchestrator = require("../../services/quality-generation-orchestrator");
const content = require("../../services/quality-lifecycle-content-service");
const lifecycle = require("../../services/quality-lifecycle-service");

function item(itemType) {
  return { item_type: itemType, resource_id: `${itemType}-1`, content: {} };
}

test("generation stage order is deterministic", () => {
  assert.equal(orchestrator.STAGE_BY_STATUS.DOCUMENT_UPLOADED, "REQUIREMENTS");
  assert.equal(orchestrator.STAGE_BY_STATUS.REQUIREMENTS_APPROVED, "TEST_SCENARIOS");
  assert.equal(orchestrator.STAGE_BY_STATUS.SCENARIOS_APPROVED, "TEST_CASES");
  assert.equal(orchestrator.STAGE_BY_STATUS.TEST_CASES_APPROVED, "TEST_DATA");
  assert.equal(orchestrator.STAGE_BY_STATUS.TEST_DATA_APPROVED, "LOGICAL_STEPS");
  assert.equal(orchestrator.STAGE_BY_STATUS.LOGICAL_STEPS_APPROVED, "TEST_SCRIPTS");
});

test("lifecycle generation policy normalizes platform and project mode", () => {
  assert.deepEqual(
    lifecycle.normalizeGenerationPolicy({ selected_platform: "windows", project_mode: "existing" }),
    { selected_platform: "WINDOWS", project_mode: "EXISTING" },
  );
  assert.throws(
    () => lifecycle.normalizeGenerationPolicy({ selected_platform: "WEB", project_mode: "NEW" }),
    /selected_platform/,
  );
});

test("Windows script generation requires application and semantic locators", () => {
  assert.throws(
    () => orchestrator.assertStageBindings("TEST_SCRIPTS", "WINDOWS", [
      item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"),
    ]),
    /APPLICATION profile.*LOCATOR_SET/s,
  );
  assert.doesNotThrow(() => orchestrator.assertStageBindings("TEST_SCRIPTS", "WINDOWS", [
    item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"), item("APPLICATION"), item("LOCATOR_SET"), item("AUTOMATION_PROJECT_PROFILE"),
  ]));
});

test("existing automation projects materialize UPDATE and REUSE files", () => {
  const value = orchestrator.materializeProjectPackages({
    stage: "TEST_SCRIPTS",
    items: [{
      item_type: "TEST_SCRIPT",
      resource_id: "TS-1",
      content: {
        project_mode: "EXISTING",
        operation: "UPDATE",
        suite_path: "tests/inventory.robot",
        script: "*** Test Cases ***\nInventory\n    Click Button    save\n    Element Should Be Visible    success\n",
        resource_files: [{ path: "resources/inventory.resource", operation: "CREATE", content: "*** Keywords ***\nSave\n    Click Button    save\n" }],
        reused_file_paths: ["resources/common.resource"],
      },
    }],
  }, [{
    item_type: "AUTOMATION_PROJECT_PROFILE",
    resource_id: "APPROJECT-1",
    content: {
      project_mode: "EXISTING",
      files: [
        { path: "tests/inventory.robot", content: "old suite" },
        { path: "resources/common.resource", content: "*** Keywords ***\nCommon\n    Log    common\n" },
      ],
    },
  }]);
  const generated = value.items[0].content;
  assert.equal(generated.automation_project_profile_reference, "APPROJECT-1");
  assert.deepEqual(generated.resource_files.map((file) => file.operation), ["CREATE", "REUSE"]);
  assert.match(generated.resource_files[1].content, /Common/);
});

test("project materialization rejects traversal and missing reuse targets", () => {
  const profile = [{
    item_type: "AUTOMATION_PROJECT_PROFILE",
    resource_id: "APPROJECT-1",
    content: { project_mode: "EXISTING", files: [{ path: "tests/a.robot", content: "old" }] },
  }];
  assert.throws(() => orchestrator.materializeProjectPackages({ items: [{
    item_type: "TEST_SCRIPT",
    content: { project_mode: "EXISTING", operation: "UPDATE", suite_path: "../a.robot", script: "x" },
  }] }, profile), /Unsafe automation project path/);
  assert.throws(() => orchestrator.materializeProjectPackages({ items: [{
    item_type: "TEST_SCRIPT",
    content: { project_mode: "EXISTING", operation: "UPDATE", suite_path: "tests/a.robot", script: "x", reused_file_paths: ["resources/missing.resource"] },
  }] }, profile), /REUSE target is absent/);
});

test("Android script generation requires application device and locator bindings", () => {
  assert.throws(
    () => orchestrator.assertStageBindings("TEST_SCRIPTS", "ANDROID", [
      item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"), item("APPLICATION"),
    ]),
    /DEVICE profile.*LOCATOR_SET/s,
  );
});

test("Embedded script generation requires approved device and target profile", () => {
  assert.throws(
    () => orchestrator.assertStageBindings("TEST_SCRIPTS", "EMBEDDED", [
      item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"), item("DEVICE"),
    ]),
    /TARGET_PROFILE/,
  );
});

test("content normalization derives immutable server-side hashes and rejects invalid content", () => {
  const normalized = content.normalizeContentInput({
    item_type: "REQUIREMENT",
    resource_id: "REQ-1",
    resource_version: "1",
    title: "Save record",
    source_item_id: "DOC-ITEM-1",
    source_anchor: { section: "3.1" },
    content_format: "JSON",
    content: {
      description: "The user shall be able to save a valid record.",
      acceptance_criteria: ["The record is visible after save."],
    },
  });
  assert.equal(normalized.item_type, "REQUIREMENT");
  assert.equal(normalized.content_format, "JSON");
  assert.equal(normalized.source_hash.length, 64);
  assert.throws(
    () => content.normalizeContentInput({
      item_type: "TEST_SCRIPT",
      resource_id: "TS-1",
      content_format: "ROBOT",
      content: "",
    }),
    /Text content is required/,
  );
});

test("automation project profiles are normalized and checksummed", () => {
  const normalized = content.normalizeContentInput({
    item_type: "AUTOMATION_PROJECT_PROFILE",
    resource_id: "APPROJECT-1",
    content_format: "PROFILE",
    content: {
      project_mode: "EXISTING",
      framework: "ROBOT_FRAMEWORK",
      files: [{ path: "resources/common.resource", content: "*** Keywords ***\nCommon\n    Log    ready\n" }],
    },
  });
  assert.equal(normalized.content_json.project_mode, "EXISTING");
  assert.equal(normalized.content_json.files[0].sha256.length, 64);
  assert.throws(() => content.validateAutomationProjectProfile({
    project_mode: "EXISTING",
    files: [{ path: "../secret.robot", content: "unsafe" }],
  }), /Unsafe automation project path/);
});
