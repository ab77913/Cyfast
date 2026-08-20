"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const orchestrator = require("../../services/quality-generation-orchestrator");
const content = require("../../services/quality-lifecycle-content-service");

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

test("Windows script generation requires application and semantic locators", () => {
  assert.throws(
    () => orchestrator.assertStageBindings("TEST_SCRIPTS", "WINDOWS", [
      item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"),
    ]),
    /APPLICATION profile.*LOCATOR_SET/s,
  );
  assert.doesNotThrow(() => orchestrator.assertStageBindings("TEST_SCRIPTS", "WINDOWS", [
    item("LOGICAL_STEP"), item("TEST_CASE"), item("TEST_DATA"), item("APPLICATION"), item("LOCATOR_SET"),
  ]));
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
