"use strict";

const lifecycle = require("./execution-lifecycle-service");
const store = require("./execution-store");
const trace = require("./execution-trace-service");
const { typedError } = require("./execution-contract");

async function startLinkedRerun(parentRunId, input, actor, relationship) {
  const parent = await store.getRun(parentRunId, actor);
  if (!parent) throw typedError("PARENT_EXECUTION_NOT_FOUND", "Parent execution run was not found", 404);
  const rootRunId = parent.root_execution_run_id || parent.execution_run_id;
  const existingAttempts = await store.db.ExecutionRun.count({
    where: {
      root_execution_run_id: rootRunId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  const run = await lifecycle.startRun({
    execution_target_id: input.execution_target_id || parent.execution_target_id,
    test_script_id: input.test_script_id || parent.test_script_id,
    test_script_version: input.test_script_version || parent.test_script_version,
    idempotency_key: input.idempotency_key,
    correlation_id: input.correlation_id,
    timeout_seconds: input.timeout_seconds,
    runtime: input.runtime || parent.runtime_snapshot || {},
    evidence_policy: input.evidence_policy || parent.evidence_policy || {},
  }, actor);
  await run.update({
    parent_execution_run_id: parent.execution_run_id,
    root_execution_run_id: rootRunId,
    attempt_number: Math.max(Number(existingAttempts || 0) + 1, Number(parent.attempt_number || 1) + 1),
    result_summary: {
      ...(run.result_summary || {}),
      linked_rerun_relationship: relationship,
      parent_execution_run_id: parent.execution_run_id,
      root_execution_run_id: rootRunId,
    },
    modified_by: actor.userId || actor.actorId,
  });
  await store.appendEvent(run, {
    event_type: "execution.linked_rerun.created.v1",
    actor_type: "USER",
    actor_id: actor.userId,
    payload: {
      relationship,
      parent_execution_run_id: parent.execution_run_id,
      root_execution_run_id: rootRunId,
      attempt_number: run.attempt_number,
    },
  });
  await trace.appendTraceLink(run, {
    link_type: "REPORT",
    resource_id: parent.execution_run_id,
    resource_version: String(parent.attempt_number || 1),
    relationship,
    source_system: "CYFAST",
    metadata: { root_execution_run_id: rootRunId },
  }, actor);
  return run;
}

module.exports = { startLinkedRerun };
