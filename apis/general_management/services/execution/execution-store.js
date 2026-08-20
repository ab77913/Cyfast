"use strict";

const crypto = require("crypto");
const db = require("../../database/mysql/models");
const {
  RUN_STATES,
  assertTransition,
  redactSecrets,
  canonicalJson,
  sha256,
  typedError,
} = require("./execution-contract");

function model(name) {
  if (!db[name]) throw typedError("EXECUTION_MODEL_UNAVAILABLE", `Execution model unavailable: ${name}`, 500);
  return db[name];
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function createTarget(input, actor) {
  return model("ExecutionTarget").create({
    execution_target_id: newId(),
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    name: input.name,
    platform: input.platform,
    endpoint: input.endpoint,
    credential_reference: input.credential_reference,
    status: input.status || "OFFLINE",
    capabilities: input.capabilities || [],
    configuration: redactSecrets(input.configuration || {}),
    version: 1,
    created_by: actor.userId,
  });
}

async function listTargets(actor, query = {}) {
  const pagination = parsePagination(query);
  const where = {
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    deleted_date: null,
  };
  if (query.platform) where.platform = String(query.platform).toUpperCase();
  if (query.status) where.status = String(query.status).toUpperCase();
  const result = await model("ExecutionTarget").findAndCountAll({
    where,
    order: [["created_date", "DESC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function getTarget(id, actor, options = {}) {
  const target = await model("ExecutionTarget").findOne({
    where: {
      execution_target_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      ...(options.includeDeleted ? {} : { deleted_date: null }),
    },
  });
  return target;
}

async function revokeTarget(id, actor) {
  const target = await getTarget(id, actor);
  if (!target) return null;
  await target.update({
    status: "REVOKED",
    revoked_at: new Date(),
    modified_by: actor.userId,
    version: Number(target.version || 1) + 1,
  });
  return target;
}

async function updateTargetHealth(id, actor, health) {
  const target = await getTarget(id, actor);
  if (!target) return null;
  const status = String(health.status || (health.ready ? "READY" : "DEGRADED")).toUpperCase();
  await target.update({
    status,
    last_seen_at: new Date(),
    last_health: redactSecrets(health),
    modified_by: actor.userId || actor.actorId,
    version: Number(target.version || 1) + 1,
  });
  return target;
}

async function createRun(input, actor) {
  return db.sequelize.transaction(async (transaction) => {
    const existing = await model("ExecutionRun").findOne({
      where: { organization_id: actor.organizationId, idempotency_key: input.idempotency_key },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) return { run: existing, created: false };

    const executionRunId = newId();
    const rootId = input.root_execution_run_id || executionRunId;
    const run = await model("ExecutionRun").create({
      execution_run_id: executionRunId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      execution_target_id: input.execution_target_id,
      test_script_id: String(input.test_script_id),
      test_script_version: input.test_script_version || null,
      parent_execution_run_id: input.parent_execution_run_id || null,
      root_execution_run_id: rootId,
      attempt_number: input.attempt_number || 1,
      platform: input.platform,
      status: RUN_STATES.CREATED,
      correlation_id: input.correlation_id || newId(),
      idempotency_key: input.idempotency_key,
      requested_by: actor.userId,
      created_by: actor.userId,
    }, { transaction });
    await appendEventInTransaction(run, {
      event_type: "execution.run.created.v1",
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        execution_target_id: input.execution_target_id,
        test_script_id: String(input.test_script_id),
        platform: input.platform,
        attempt_number: input.attempt_number || 1,
        parent_execution_run_id: input.parent_execution_run_id || null,
      },
    }, transaction);
    return { run, created: true };
  });
}

async function getRun(id, actor) {
  return model("ExecutionRun").findOne({
    where: {
      execution_run_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
}

async function listRuns(actor, query = {}) {
  const pagination = parsePagination(query);
  const where = {
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    deleted_date: null,
  };
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.platform) where.platform = String(query.platform).toUpperCase();
  if (query.execution_target_id) where.execution_target_id = query.execution_target_id;
  if (query.test_script_id !== undefined) where.test_script_id = String(query.test_script_id);
  if (query.root_execution_run_id) where.root_execution_run_id = query.root_execution_run_id;
  const result = await model("ExecutionRun").findAndCountAll({
    where,
    order: [["created_date", "DESC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function transitionRun(id, actor, nextState, patch = {}, event = {}) {
  return db.sequelize.transaction(async (transaction) => {
    const run = await model("ExecutionRun").findOne({
      where: {
        execution_run_id: id,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
        deleted_date: null,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!run) return null;
    if (run.status !== nextState) assertTransition(run.status, nextState);
    const safePatch = redactSecrets(patch || {});
    await run.update({
      ...safePatch,
      status: nextState,
      modified_by: actor.userId || actor.actorId,
    }, { transaction });
    await appendEventInTransaction(run, {
      event_type: event.event_type || `execution.run.${String(nextState).toLowerCase()}.v1`,
      actor_type: event.actor_type || actor.actorType || "SYSTEM",
      actor_id: event.actor_id || actor.userId || actor.actorId,
      payload: { previous_status: run._previousDataValues?.status, status: nextState, ...redactSecrets(event.payload || {}) },
    }, transaction);
    return run;
  });
}

async function patchRun(id, actor, patch, eventType = "execution.run.updated.v1") {
  return db.sequelize.transaction(async (transaction) => {
    const run = await model("ExecutionRun").findOne({
      where: { execution_run_id: id, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!run) return null;
    const safePatch = redactSecrets(patch || {});
    await run.update({ ...safePatch, modified_by: actor.userId || actor.actorId }, { transaction });
    await appendEventInTransaction(run, {
      event_type: eventType,
      actor_type: actor.actorType || "SYSTEM",
      actor_id: actor.userId || actor.actorId,
      payload: safePatch,
    }, transaction);
    return run;
  });
}

async function appendEvent(run, event, transaction = null) {
  if (transaction) return appendEventInTransaction(run, event, transaction);
  return db.sequelize.transaction((tx) => appendEventInTransaction(run, event, tx));
}

async function appendEventInTransaction(run, event, transaction) {
  await model("ExecutionRun").findByPk(run.execution_run_id, { transaction, lock: transaction.LOCK.UPDATE });
  const maximum = await model("ExecutionEvent").max("sequence_number", {
    where: { execution_run_id: run.execution_run_id },
    transaction,
  });
  const payload = redactSecrets(event.payload || {});
  return model("ExecutionEvent").create({
    execution_event_id: newId(),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    sequence_number: Number(maximum || 0) + 1,
    event_type: event.event_type,
    actor_type: event.actor_type || "SYSTEM",
    actor_id: event.actor_id || null,
    payload,
    payload_hash: sha256(canonicalJson(payload)),
    occurred_at: event.occurred_at || new Date(),
    created_by: event.actor_id || "execution-lifecycle",
  }, { transaction });
}

async function listEvents(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const result = await model("ExecutionEvent").findAndCountAll({
    where: { execution_run_id: runId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
    order: [["sequence_number", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function appendArtifact(run, artifact, actor, transaction = null) {
  const values = {
    execution_artifact_id: artifact.execution_artifact_id || newId(),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    artifact_type: artifact.artifact_type,
    storage_file_id: String(artifact.storage_file_id),
    filename: artifact.filename,
    content_type: artifact.content_type,
    content_hash: String(artifact.content_hash).toLowerCase(),
    size_bytes: Number(artifact.size_bytes),
    retention_classification: artifact.retention_classification || "STANDARD",
    metadata: redactSecrets(artifact.metadata || {}),
    captured_at: artifact.captured_at || new Date(),
    expires_at: artifact.expires_at || null,
    created_by: actor.userId || actor.actorId || "execution-lifecycle",
  };
  const [row] = await model("ExecutionArtifact").findOrCreate({
    where: {
      execution_run_id: run.execution_run_id,
      artifact_type: values.artifact_type,
      content_hash: values.content_hash,
    },
    defaults: values,
    transaction,
  });
  return row;
}

async function listArtifacts(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const where = { execution_run_id: runId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null };
  if (query.artifact_type) where.artifact_type = String(query.artifact_type).toLowerCase();
  const result = await model("ExecutionArtifact").findAndCountAll({
    where,
    order: [["captured_at", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function appendRecording(run, recording, actor) {
  return model("ExecutionRecording").create({
    execution_recording_id: newId(),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    execution_artifact_id: recording.execution_artifact_id,
    recording_type: recording.recording_type,
    format: recording.format,
    redacted: recording.redacted !== false,
    started_at: recording.started_at,
    finished_at: recording.finished_at,
    metadata: redactSecrets(recording.metadata || {}),
    created_by: actor.userId || actor.actorId || "execution-lifecycle",
  });
}

async function listRecordings(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 50 });
  const result = await model("ExecutionRecording").findAndCountAll({
    where: { execution_run_id: runId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
    order: [["started_at", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function createDefect(run, defect, actor) {
  return model("ExecutionDefect").create({
    execution_defect_id: newId(),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    root_execution_run_id: run.root_execution_run_id || run.execution_run_id,
    rerun_execution_run_id: defect.rerun_execution_run_id || null,
    requirement_id: defect.requirement_id || null,
    test_scenario_id: defect.test_scenario_id || null,
    test_case_id: defect.test_case_id || null,
    test_script_id: defect.test_script_id || run.test_script_id,
    classification: defect.classification,
    severity: defect.severity || "MEDIUM",
    status: defect.status || "OPEN",
    title: defect.title,
    description: defect.description || null,
    expected_result: defect.expected_result || null,
    actual_result: defect.actual_result || null,
    assigned_to: defect.assigned_to || null,
    created_by: actor.userId || actor.actorId || "execution-lifecycle",
  });
}

async function listDefects(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 50 });
  const result = await model("ExecutionDefect").findAndCountAll({
    where: { execution_run_id: runId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
    order: [["created_date", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function updateDefect(defectId, actor, patch) {
  const defect = await model("ExecutionDefect").findOne({
    where: { execution_defect_id: defectId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
  });
  if (!defect) return null;
  const allowed = [
    "status", "severity", "assigned_to", "product_repository", "product_commit", "product_pull_request",
    "resolution", "rerun_execution_run_id",
  ];
  const update = {};
  for (const key of allowed) if (patch[key] !== undefined) update[key] = patch[key];
  if (update.status === "RESOLVED") update.resolved_at = new Date();
  update.modified_by = actor.userId;
  await defect.update(redactSecrets(update));
  return defect;
}

async function createRepairAttempt(run, repair, actor) {
  return model("ExecutionRepairAttempt").create({
    execution_repair_attempt_id: newId(),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    rerun_execution_run_id: repair.rerun_execution_run_id || null,
    attempt_number: repair.attempt_number,
    failure_classification: repair.failure_classification,
    base_script_version: repair.base_script_version || run.test_script_version,
    proposed_script_hash: repair.proposed_script_hash,
    proposed_patch: repair.proposed_patch,
    rationale: repair.rationale || null,
    validation_result: redactSecrets(repair.validation_result || {}),
    approval_status: repair.approval_status || "PENDING",
    created_by: actor.userId,
  });
}

async function getRepairAttempt(id, actor) {
  return model("ExecutionRepairAttempt").findOne({
    where: {
      execution_repair_attempt_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
}

async function approveRepairAttempt(id, actor, rerunExecutionRunId) {
  const repair = await getRepairAttempt(id, actor);
  if (!repair) return null;
  await repair.update({
    approval_status: "APPROVED",
    approved_by: actor.userId,
    approved_at: new Date(),
    rerun_execution_run_id: rerunExecutionRunId || repair.rerun_execution_run_id,
    modified_by: actor.userId,
  });
  return repair;
}

async function listRepairAttempts(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 20 });
  const result = await model("ExecutionRepairAttempt").findAndCountAll({
    where: { execution_run_id: runId, organization_id: actor.organizationId, project_id: actor.projectId, deleted_date: null },
    order: [["attempt_number", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

function parsePagination(query = {}, options = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const defaultPageSize = options.defaultPageSize || 25;
  const pageSize = Math.min(Math.max(Number.parseInt(query.page_size || query.pageSize, 10) || defaultPageSize, 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function pageResult(result, pagination) {
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

module.exports = {
  db,
  model,
  newId,
  createTarget,
  listTargets,
  getTarget,
  revokeTarget,
  updateTargetHealth,
  createRun,
  getRun,
  listRuns,
  transitionRun,
  patchRun,
  appendEvent,
  listEvents,
  appendArtifact,
  listArtifacts,
  appendRecording,
  listRecordings,
  createDefect,
  listDefects,
  updateDefect,
  createRepairAttempt,
  getRepairAttempt,
  approveRepairAttempt,
  listRepairAttempts,
  parsePagination,
};
