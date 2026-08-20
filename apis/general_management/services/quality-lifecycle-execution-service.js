"use strict";

const crypto = require("crypto");
const db = require("../database/mysql/models");
const quality = require("./quality-lifecycle-service");
const execution = require("./execution/execution-lifecycle-service");
const trace = require("./execution/execution-trace-service");
const { sha256, typedError } = require("./execution/execution-contract");
const { parsePagination } = require("./execution/execution-store");

function linkModel() {
  if (!db.QualityLifecycleExecutionLink) {
    throw typedError("QUALITY_EXECUTION_LINK_MODEL_UNAVAILABLE", "QualityLifecycleExecutionLink model is unavailable", 500);
  }
  return db.QualityLifecycleExecutionLink;
}

async function startLifecycleExecution(lifecycleId, input, actor) {
  const lifecycle = await quality.getLifecycle(lifecycleId, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  if (lifecycle.status !== quality.STATES.READY_FOR_EXECUTION || lifecycle.ready_for_execution !== true) {
    throw typedError("QUALITY_LIFECYCLE_NOT_READY", `Lifecycle is not ready for execution: ${lifecycle.status}`, 409);
  }
  const readiness = await quality.getReadiness(lifecycleId, actor);
  if (!readiness.ready) throw typedError("QUALITY_LIFECYCLE_NOT_READY", readiness.errors.join(" | "), 422);

  const scripts = await db.QualityLifecycleItem.findAll({
    where: {
      quality_lifecycle_id: lifecycleId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: "TEST_SCRIPT",
      approval_status: "APPROVED",
      deleted_date: null,
    },
    order: [["created_date", "DESC"]],
  });
  if (!scripts.length) throw typedError("APPROVED_TEST_SCRIPT_REQUIRED", "An approved Test Script version is required", 422);
  const selected = input.test_script_item_id
    ? scripts.find((item) => item.quality_lifecycle_item_id === input.test_script_item_id)
    : scripts[0];
  if (!selected) throw typedError("TEST_SCRIPT_ITEM_NOT_FOUND", "Selected Test Script lifecycle item was not found", 404);

  const run = await execution.startRun({
    execution_target_id: input.execution_target_id,
    test_script_id: selected.resource_id,
    test_script_version: selected.resource_version,
    idempotency_key: input.idempotency_key,
    correlation_id: input.correlation_id,
    timeout_seconds: input.timeout_seconds,
    runtime: input.runtime,
    evidence_policy: input.evidence_policy,
  }, actor);
  await linkRun(lifecycle, run, "PRIMARY", actor);

  const lifecycleItems = await db.QualityLifecycleItem.findAll({
    where: {
      quality_lifecycle_id: lifecycleId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
    order: [["created_date", "ASC"]],
  });
  const links = lifecycleItems.map((item) => ({
    link_type: traceType(item.item_type),
    resource_id: String(item.resource_id),
    resource_version: String(item.resource_version),
    relationship: item.item_type === "TEST_SCRIPT" ? "USES" : "DERIVED_FROM",
    source_system: "CYFAST",
    metadata: {
      quality_lifecycle_id: lifecycleId,
      quality_lifecycle_item_id: item.quality_lifecycle_item_id,
      source_item_id: item.source_item_id,
      source_anchor: item.source_anchor,
      approval_status: item.approval_status,
      content_hash: item.content_hash,
    },
  })).filter((item) => item.link_type);
  await trace.appendTraceLinks(run, links, actor);

  await quality.addItem(lifecycleId, {
    item_type: "EXECUTION_RUN",
    resource_id: run.execution_run_id,
    resource_version: String(run.attempt_number || 1),
    source_item_id: selected.quality_lifecycle_item_id,
    source_anchor: {
      test_script_id: selected.resource_id,
      test_script_version: selected.resource_version,
      execution_target_id: run.execution_target_id,
    },
    generation_metadata: { origin: "CYFAST_EXECUTION", status: run.status },
    approval_status: "APPROVED",
    content_hash: sha256(run.execution_run_id),
  }, actor);
  await quality.transition(lifecycleId, quality.STATES.EXECUTING, actor, {
    active_execution_run_id: run.execution_run_id,
  });
  return { lifecycle_id: lifecycleId, run };
}

async function synchronizeRun(run, actor) {
  const runValue = run.toJSON ? run.toJSON() : run;
  let link = await linkModel().findOne({
    where: {
      execution_run_id: runValue.execution_run_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
    },
  });
  if (!link && runValue.parent_execution_run_id) {
    const parent = await linkModel().findOne({
      where: {
        execution_run_id: runValue.parent_execution_run_id,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
      },
    });
    if (parent) {
      const lifecycle = await quality.getLifecycle(parent.quality_lifecycle_id, actor);
      if (lifecycle) link = await linkRun(lifecycle, runValue, "RERUN", actor);
    }
  }
  if (!link) return null;
  await link.update({
    status_snapshot: runValue.status,
    modified_by: actor.userId || actor.actorId,
  });
  const lifecycle = await quality.getLifecycle(link.quality_lifecycle_id, actor);
  if (!lifecycle) return link;
  if (runValue.status === "PASSED" && lifecycle.status === quality.STATES.EXECUTING) {
    await quality.transition(lifecycle.quality_lifecycle_id, quality.STATES.COMPLETED, actor, {
      completed_execution_run_id: runValue.execution_run_id,
    });
  } else if (["FAILED", "BLOCKED"].includes(runValue.status) && lifecycle.status === quality.STATES.EXECUTING) {
    await quality.transition(lifecycle.quality_lifecycle_id, quality.STATES.FAILED, actor, {
      completed_execution_run_id: runValue.execution_run_id,
      failure_classification: runValue.failure_classification,
    });
  } else if (runValue.status === "CANCELLED" && lifecycle.status === quality.STATES.EXECUTING) {
    await quality.transition(lifecycle.quality_lifecycle_id, quality.STATES.CANCELLED, actor, {
      completed_execution_run_id: runValue.execution_run_id,
    });
  }
  return link;
}

async function listLifecycleExecutions(lifecycleId, actor, query = {}) {
  const lifecycle = await quality.getLifecycle(lifecycleId, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  const pagination = parsePagination(query, { defaultPageSize: 50 });
  const result = await linkModel().findAndCountAll({
    where: {
      quality_lifecycle_id: lifecycleId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
    },
    order: [["created_date", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  const total = Number(result.count || 0);
  return {
    items: result.rows,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      total_pages: Math.max(Math.ceil(total / pagination.pageSize), 1),
    },
  };
}

async function linkRun(lifecycle, run, relationship, actor) {
  const runValue = run.toJSON ? run.toJSON() : run;
  const [link] = await linkModel().findOrCreate({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      execution_run_id: runValue.execution_run_id,
    },
    defaults: {
      quality_lifecycle_execution_link_id: crypto.randomUUID().replace(/-/g, ""),
      organization_id: lifecycle.organization_id,
      project_id: lifecycle.project_id,
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      execution_run_id: runValue.execution_run_id,
      root_execution_run_id: runValue.root_execution_run_id || runValue.execution_run_id,
      relationship,
      status_snapshot: runValue.status,
      created_by: actor.userId || actor.actorId,
    },
  });
  return link;
}

function traceType(itemType) {
  return {
    DOCUMENT: "DOCUMENT",
    REQUIREMENT: "REQUIREMENT",
    RISK: "RISK",
    TEST_SCENARIO: "TEST_SCENARIO",
    TEST_CASE: "TEST_CASE",
    TEST_DATA: "TEST_DATA",
    LOGICAL_STEP: "LOGICAL_STEP",
    TEST_SCRIPT: "TEST_SCRIPT",
    VALIDATION_REPORT: "REPORT",
    EXECUTION_RUN: null,
    DEFECT: "DEFECT",
    REPORT: "REPORT",
  }[itemType] || null;
}

module.exports = {
  startLifecycleExecution,
  synchronizeRun,
  listLifecycleExecutions,
  linkRun,
  traceType,
};
