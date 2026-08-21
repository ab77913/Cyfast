"use strict";

const crypto = require("crypto");
const db = require("../database/mysql/models");
const {
  canonicalJson,
  sha256,
  redactSecrets,
  typedError,
} = require("./execution/execution-contract");
const { parsePagination } = require("./execution/execution-store");

const STATES = Object.freeze({
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  REQUIREMENTS_GENERATED: "REQUIREMENTS_GENERATED",
  REQUIREMENTS_APPROVED: "REQUIREMENTS_APPROVED",
  SCENARIOS_GENERATED: "SCENARIOS_GENERATED",
  SCENARIOS_APPROVED: "SCENARIOS_APPROVED",
  TEST_CASES_GENERATED: "TEST_CASES_GENERATED",
  TEST_CASES_APPROVED: "TEST_CASES_APPROVED",
  TEST_DATA_GENERATED: "TEST_DATA_GENERATED",
  TEST_DATA_APPROVED: "TEST_DATA_APPROVED",
  LOGICAL_STEPS_GENERATED: "LOGICAL_STEPS_GENERATED",
  LOGICAL_STEPS_APPROVED: "LOGICAL_STEPS_APPROVED",
  SCRIPT_GENERATED: "SCRIPT_GENERATED",
  SCRIPT_VALIDATED: "SCRIPT_VALIDATED",
  READY_FOR_EXECUTION: "READY_FOR_EXECUTION",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

const STAGES = Object.freeze({
  DOCUMENT_UPLOADED: "DOCUMENT",
  REQUIREMENTS_GENERATED: "REQUIREMENT",
  REQUIREMENTS_APPROVED: "REQUIREMENT",
  SCENARIOS_GENERATED: "TEST_SCENARIO",
  SCENARIOS_APPROVED: "TEST_SCENARIO",
  TEST_CASES_GENERATED: "TEST_CASE",
  TEST_CASES_APPROVED: "TEST_CASE",
  TEST_DATA_GENERATED: "TEST_DATA",
  TEST_DATA_APPROVED: "TEST_DATA",
  LOGICAL_STEPS_GENERATED: "LOGICAL_STEP",
  SCRIPT_GENERATED: "TEST_SCRIPT",
  SCRIPT_VALIDATED: "VALIDATION_REPORT",
  READY_FOR_EXECUTION: "EXECUTION",
  EXECUTING: "EXECUTION",
  COMPLETED: "REPORT",
  FAILED: "EXECUTION",
  CANCELLED: "EXECUTION",
});

const TRANSITIONS = Object.freeze({
  DOCUMENT_UPLOADED: new Set([STATES.REQUIREMENTS_GENERATED, STATES.CANCELLED]),
  REQUIREMENTS_GENERATED: new Set([STATES.REQUIREMENTS_APPROVED, STATES.CANCELLED]),
  REQUIREMENTS_APPROVED: new Set([STATES.SCENARIOS_GENERATED, STATES.CANCELLED]),
  SCENARIOS_GENERATED: new Set([STATES.SCENARIOS_APPROVED, STATES.CANCELLED]),
  SCENARIOS_APPROVED: new Set([STATES.TEST_CASES_GENERATED, STATES.CANCELLED]),
  TEST_CASES_GENERATED: new Set([STATES.TEST_CASES_APPROVED, STATES.CANCELLED]),
  TEST_CASES_APPROVED: new Set([STATES.TEST_DATA_GENERATED, STATES.CANCELLED]),
  TEST_DATA_GENERATED: new Set([STATES.TEST_DATA_APPROVED, STATES.CANCELLED]),
  TEST_DATA_APPROVED: new Set([STATES.LOGICAL_STEPS_GENERATED, STATES.CANCELLED]),
  LOGICAL_STEPS_GENERATED: new Set([STATES.SCRIPT_GENERATED, STATES.CANCELLED]),
  SCRIPT_GENERATED: new Set([STATES.SCRIPT_VALIDATED, STATES.CANCELLED]),
  SCRIPT_VALIDATED: new Set([STATES.READY_FOR_EXECUTION, STATES.CANCELLED]),
  READY_FOR_EXECUTION: new Set([STATES.EXECUTING, STATES.CANCELLED]),
  EXECUTING: new Set([STATES.COMPLETED, STATES.FAILED, STATES.CANCELLED]),
  COMPLETED: new Set([]),
  FAILED: new Set([]),
  CANCELLED: new Set([]),
});

const ITEM_TYPES = Object.freeze([
  "DOCUMENT",
  "REQUIREMENT",
  "RISK",
  "TEST_SCENARIO",
  "TEST_CASE",
  "TEST_DATA",
  "LOGICAL_STEP",
  "APPLICATION",
  "DEVICE",
  "LOCATOR_SET",
  "TARGET_PROFILE",
  "AUTOMATION_PROJECT_PROFILE",
  "TEST_SCRIPT",
  "VALIDATION_REPORT",
  "EXECUTION_RUN",
  "DEFECT",
  "REPORT",
]);

const APPROVAL_REQUIRED_TYPES = new Set([
  "REQUIREMENT",
  "TEST_SCENARIO",
  "TEST_CASE",
  "TEST_DATA",
  "LOGICAL_STEP",
  "APPLICATION",
  "DEVICE",
  "LOCATOR_SET",
  "TARGET_PROFILE",
  "AUTOMATION_PROJECT_PROFILE",
  "TEST_SCRIPT",
  "VALIDATION_REPORT",
]);

function lifecycleModel() {
  if (!db.QualityLifecycle) throw typedError("QUALITY_LIFECYCLE_MODEL_UNAVAILABLE", "QualityLifecycle model is unavailable", 500);
  return db.QualityLifecycle;
}

function itemModel() {
  if (!db.QualityLifecycleItem) throw typedError("QUALITY_LIFECYCLE_ITEM_MODEL_UNAVAILABLE", "QualityLifecycleItem model is unavailable", 500);
  return db.QualityLifecycleItem;
}

function eventModel() {
  if (!db.QualityLifecycleEvent) throw typedError("QUALITY_LIFECYCLE_EVENT_MODEL_UNAVAILABLE", "QualityLifecycleEvent model is unavailable", 500);
  return db.QualityLifecycleEvent;
}

async function createLifecycle(input, actor) {
  const name = String(input.name || "").trim();
  const documentId = String(input.source_document_file_id || "").trim();
  const documentHash = String(input.source_document_hash || "").trim().toLowerCase();
  const documentVersion = String(input.source_document_version || "1").trim();
  if (name.length < 2 || name.length > 255) throw typedError("LIFECYCLE_NAME_INVALID", "Lifecycle name must contain 2-255 characters", 400);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(documentId)) throw typedError("SOURCE_DOCUMENT_INVALID", "source_document_file_id is invalid", 400);
  if (!/^[a-f0-9]{64}$/.test(documentHash)) throw typedError("SOURCE_DOCUMENT_HASH_INVALID", "source_document_hash must be SHA-256", 400);
  if (!/^[A-Za-z0-9._:+-]{1,64}$/.test(documentVersion)) throw typedError("SOURCE_DOCUMENT_VERSION_INVALID", "source_document_version is invalid", 400);

  return db.sequelize.transaction(async (transaction) => {
    const id = newId();
    const lifecycle = await lifecycleModel().create({
      quality_lifecycle_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      name,
      source_document_file_id: documentId,
      source_document_hash: documentHash,
      source_document_version: documentVersion,
      status: STATES.DOCUMENT_UPLOADED,
      current_stage: STAGES[STATES.DOCUMENT_UPLOADED],
      generation_policy: normalizeGenerationPolicy(input.generation_policy || defaultGenerationPolicy()),
      acceptance_policy: redactSecrets(input.acceptance_policy || defaultAcceptancePolicy()),
      traceability_complete: false,
      ready_for_execution: false,
      version: 1,
      created_by: actor.userId,
    }, { transaction });
    const documentItem = await itemModel().create({
      quality_lifecycle_item_id: newId(),
      quality_lifecycle_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      item_type: "DOCUMENT",
      resource_id: documentId,
      resource_version: documentVersion,
      source_item_id: null,
      source_anchor: { storage_file_id: documentId, content_hash: documentHash },
      generation_metadata: { origin: "USER_UPLOAD" },
      approval_status: "APPROVED",
      approved_by: actor.userId,
      approved_at: new Date(),
      content_hash: documentHash,
      created_by: actor.userId,
    }, { transaction });
    await appendEvent(lifecycle, {
      event_type: "quality.lifecycle.created.v1",
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        document_item_id: documentItem.quality_lifecycle_item_id,
        source_document_file_id: documentId,
        source_document_version: documentVersion,
      },
    }, transaction);
    return lifecycle;
  });
}

async function getLifecycle(id, actor) {
  return lifecycleModel().findOne({
    where: {
      quality_lifecycle_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
}

async function listLifecycles(actor, query = {}) {
  const pagination = parsePagination(query);
  const where = {
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    deleted_date: null,
  };
  if (query.status) where.status = String(query.status).toUpperCase();
  const result = await lifecycleModel().findAndCountAll({
    where,
    order: [["created_date", "DESC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function addItem(lifecycleId, input, actor) {
  return db.sequelize.transaction(async (transaction) => {
    const lifecycle = await lockLifecycle(lifecycleId, actor, transaction);
    const value = normalizeItem(input);
    assertItemAllowedForState(lifecycle.status, value.item_type);
    if (value.item_type !== "DOCUMENT") await validateSourceItem(lifecycle, value, transaction);
    const [item, created] = await itemModel().findOrCreate({
      where: {
        quality_lifecycle_id: lifecycle.quality_lifecycle_id,
        item_type: value.item_type,
        resource_id: value.resource_id,
        resource_version: value.resource_version,
      },
      defaults: {
        quality_lifecycle_item_id: newId(),
        quality_lifecycle_id: lifecycle.quality_lifecycle_id,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
        ...value,
        approval_status: value.approval_status,
        approved_by: value.approval_status === "APPROVED" ? actor.userId : null,
        approved_at: value.approval_status === "APPROVED" ? new Date() : null,
        created_by: actor.userId,
      },
      transaction,
    });
    if (created) {
      await appendEvent(lifecycle, {
        event_type: "quality.lifecycle.item.added.v1",
        actor_type: value.generation_metadata.origin === "AI" ? "AI" : "USER",
        actor_id: value.generation_metadata.model_id || actor.userId,
        payload: {
          quality_lifecycle_item_id: item.quality_lifecycle_item_id,
          item_type: item.item_type,
          resource_id: item.resource_id,
          resource_version: item.resource_version,
          source_item_id: item.source_item_id,
          approval_status: item.approval_status,
        },
      }, transaction);
    }
    return item;
  });
}

async function approveItem(lifecycleId, itemId, decision, actor) {
  return db.sequelize.transaction(async (transaction) => {
    const lifecycle = await lockLifecycle(lifecycleId, actor, transaction);
    const item = await itemModel().findOne({
      where: {
        quality_lifecycle_item_id: itemId,
        quality_lifecycle_id: lifecycleId,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
        deleted_date: null,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!item) throw typedError("LIFECYCLE_ITEM_NOT_FOUND", "Lifecycle item was not found", 404);
    const status = String(decision.approval_status || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(status)) throw typedError("APPROVAL_DECISION_INVALID", "approval_status must be APPROVED or REJECTED", 400);
    await item.update({
      approval_status: status,
      approved_by: actor.userId,
      approved_at: new Date(),
      modified_by: actor.userId,
      generation_metadata: {
        ...(item.generation_metadata || {}),
        approval_comment: String(decision.comment || "").slice(0, 4096),
      },
    }, { transaction });
    await appendEvent(lifecycle, {
      event_type: `quality.lifecycle.item.${status.toLowerCase()}.v1`,
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        quality_lifecycle_item_id: itemId,
        item_type: item.item_type,
        resource_id: item.resource_id,
        approval_status: status,
      },
    }, transaction);
    return item;
  });
}

async function transition(lifecycleId, nextState, actor, metadata = {}) {
  const normalizedNext = String(nextState || "").toUpperCase();
  if (!Object.values(STATES).includes(normalizedNext)) throw typedError("LIFECYCLE_STATE_INVALID", `Unknown lifecycle state: ${nextState}`, 400);
  return db.sequelize.transaction(async (transaction) => {
    const lifecycle = await lockLifecycle(lifecycleId, actor, transaction);
    if (!TRANSITIONS[lifecycle.status]?.has(normalizedNext)) {
      throw typedError("LIFECYCLE_TRANSITION_INVALID", `Lifecycle cannot transition from ${lifecycle.status} to ${normalizedNext}`, 409);
    }
    await assertTransitionGate(lifecycle, normalizedNext, transaction);
    const readiness = normalizedNext === STATES.READY_FOR_EXECUTION
      ? await evaluateReadiness(lifecycle, transaction)
      : null;
    if (readiness && !readiness.ready) throw typedError("LIFECYCLE_NOT_READY", readiness.errors.join(" | "), 422);
    const oldStatus = lifecycle.status;
    await lifecycle.update({
      status: normalizedNext,
      current_stage: STAGES[normalizedNext],
      traceability_complete: readiness ? readiness.traceability_complete : lifecycle.traceability_complete,
      ready_for_execution: normalizedNext === STATES.READY_FOR_EXECUTION,
      version: Number(lifecycle.version || 1) + 1,
      modified_by: actor.userId || actor.actorId,
      ...(metadata.active_execution_run_id ? { active_execution_run_id: metadata.active_execution_run_id } : {}),
      ...(metadata.completed_execution_run_id ? { completed_execution_run_id: metadata.completed_execution_run_id } : {}),
    }, { transaction });
    await appendEvent(lifecycle, {
      event_type: `quality.lifecycle.${normalizedNext.toLowerCase()}.v1`,
      actor_type: actor.actorType || "USER",
      actor_id: actor.userId || actor.actorId,
      payload: {
        previous_status: oldStatus,
        status: normalizedNext,
        current_stage: STAGES[normalizedNext],
        ...redactSecrets(metadata),
      },
    }, transaction);
    return lifecycle;
  });
}

async function listItems(lifecycleId, actor, query = {}) {
  await requireLifecycle(lifecycleId, actor);
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const where = {
    quality_lifecycle_id: lifecycleId,
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    deleted_date: null,
  };
  if (query.item_type) where.item_type = String(query.item_type).toUpperCase();
  if (query.approval_status) where.approval_status = String(query.approval_status).toUpperCase();
  const result = await itemModel().findAndCountAll({
    where,
    order: [["created_date", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function listEvents(lifecycleId, actor, query = {}) {
  await requireLifecycle(lifecycleId, actor);
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const result = await eventModel().findAndCountAll({
    where: {
      quality_lifecycle_id: lifecycleId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
    },
    order: [["sequence_number", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  return pageResult(result, pagination);
}

async function getReadiness(lifecycleId, actor) {
  const lifecycle = await requireLifecycle(lifecycleId, actor);
  return evaluateReadiness(lifecycle, null);
}

async function evaluateReadiness(lifecycle, transaction = null) {
  const items = await itemModel().findAll({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: lifecycle.organization_id,
      project_id: lifecycle.project_id,
      deleted_date: null,
    },
    transaction,
  });
  const values = items.map((item) => item.toJSON ? item.toJSON() : item);
  const errors = [];
  const required = [
    "DOCUMENT",
    "REQUIREMENT",
    "TEST_SCENARIO",
    "TEST_CASE",
    "TEST_DATA",
    "LOGICAL_STEP",
    "TEST_SCRIPT",
    "VALIDATION_REPORT",
    "AUTOMATION_PROJECT_PROFILE",
  ];
  for (const type of required) {
    const typed = values.filter((item) => item.item_type === type);
    if (!typed.length) errors.push(`Missing lifecycle item type: ${type}`);
    if (APPROVAL_REQUIRED_TYPES.has(type) && typed.some((item) => item.approval_status !== "APPROVED")) {
      errors.push(`All ${type} items must be approved`);
    }
  }
  const approvedTypes = new Set(values
    .filter((item) => item.approval_status === "APPROVED")
    .map((item) => item.item_type));
  const selectedPlatform = String(lifecycle.generation_policy?.selected_platform || lifecycle.generation_policy?.platform || "").toUpperCase();
  const bindingTypes = {
    WINDOWS: ["APPLICATION", "LOCATOR_SET"],
    LINUX: ["TARGET_PROFILE"],
    ANDROID: ["APPLICATION", "DEVICE", "LOCATOR_SET"],
    EMBEDDED: ["DEVICE", "TARGET_PROFILE"],
  }[selectedPlatform] || [];
  for (const type of bindingTypes) {
    if (!approvedTypes.has(type)) errors.push(`Approved ${type} binding is required for ${selectedPlatform}`);
  }
  const traceabilityErrors = validateTraceability(values);
  errors.push(...traceabilityErrors);
  return {
    ready: errors.length === 0,
    traceability_complete: traceabilityErrors.length === 0,
    errors,
    item_counts: countBy(values, (item) => item.item_type),
    evaluated_at: new Date().toISOString(),
  };
}

async function assertTransitionGate(lifecycle, nextState, transaction) {
  const requiredByState = {
    REQUIREMENTS_GENERATED: ["REQUIREMENT"],
    REQUIREMENTS_APPROVED: ["REQUIREMENT"],
    SCENARIOS_GENERATED: ["TEST_SCENARIO"],
    SCENARIOS_APPROVED: ["TEST_SCENARIO"],
    TEST_CASES_GENERATED: ["TEST_CASE"],
    TEST_CASES_APPROVED: ["TEST_CASE"],
    TEST_DATA_GENERATED: ["TEST_DATA"],
    TEST_DATA_APPROVED: ["TEST_DATA"],
    LOGICAL_STEPS_GENERATED: ["LOGICAL_STEP"],
    SCRIPT_GENERATED: ["TEST_SCRIPT"],
    SCRIPT_VALIDATED: ["TEST_SCRIPT", "VALIDATION_REPORT"],
    READY_FOR_EXECUTION: ["TEST_SCRIPT", "VALIDATION_REPORT"],
  };
  const types = requiredByState[nextState] || [];
  if (!types.length) return;
  const items = await itemModel().findAll({
    where: {
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: lifecycle.organization_id,
      project_id: lifecycle.project_id,
      item_type: types,
      deleted_date: null,
    },
    transaction,
  });
  for (const type of types) {
    const matching = items.filter((item) => item.item_type === type);
    if (!matching.length) throw typedError("LIFECYCLE_GATE_MISSING_ITEMS", `${type} items are required before ${nextState}`, 422);
    if (nextState.endsWith("_APPROVED") || [STATES.SCRIPT_VALIDATED, STATES.READY_FOR_EXECUTION].includes(nextState)) {
      if (matching.some((item) => item.approval_status !== "APPROVED")) {
        throw typedError("LIFECYCLE_GATE_APPROVAL_REQUIRED", `All ${type} items must be approved before ${nextState}`, 422);
      }
    }
  }
}

function assertItemAllowedForState(status, itemType) {
  if (["APPLICATION", "DEVICE", "LOCATOR_SET", "TARGET_PROFILE", "AUTOMATION_PROJECT_PROFILE"].includes(itemType) &&
      ![STATES.COMPLETED, STATES.CANCELLED].includes(status)) return;
  const allowed = {
    DOCUMENT_UPLOADED: ["REQUIREMENT", "RISK"],
    REQUIREMENTS_GENERATED: ["REQUIREMENT", "RISK"],
    REQUIREMENTS_APPROVED: ["TEST_SCENARIO", "RISK"],
    SCENARIOS_GENERATED: ["TEST_SCENARIO"],
    SCENARIOS_APPROVED: ["TEST_CASE"],
    TEST_CASES_GENERATED: ["TEST_CASE"],
    TEST_CASES_APPROVED: ["TEST_DATA"],
    TEST_DATA_GENERATED: ["TEST_DATA"],
    TEST_DATA_APPROVED: ["LOGICAL_STEP"],
    LOGICAL_STEPS_GENERATED: ["LOGICAL_STEP", "TEST_SCRIPT"],
    SCRIPT_GENERATED: ["TEST_SCRIPT", "VALIDATION_REPORT"],
    SCRIPT_VALIDATED: ["TEST_SCRIPT", "VALIDATION_REPORT"],
    READY_FOR_EXECUTION: ["EXECUTION_RUN"],
    EXECUTING: ["EXECUTION_RUN", "DEFECT", "REPORT"],
    COMPLETED: ["REPORT", "DEFECT"],
    FAILED: ["DEFECT", "REPORT"],
  };
  if (!(allowed[status] || []).includes(itemType)) {
    throw typedError("LIFECYCLE_ITEM_NOT_ALLOWED", `${itemType} cannot be added while lifecycle is ${status}`, 409);
  }
}

async function validateSourceItem(lifecycle, value, transaction) {
  if (!value.source_item_id) throw typedError("SOURCE_ITEM_REQUIRED", `${value.item_type} requires source_item_id`, 422);
  const source = await itemModel().findOne({
    where: {
      quality_lifecycle_item_id: value.source_item_id,
      quality_lifecycle_id: lifecycle.quality_lifecycle_id,
      organization_id: lifecycle.organization_id,
      project_id: lifecycle.project_id,
      deleted_date: null,
    },
    transaction,
  });
  if (!source) throw typedError("SOURCE_ITEM_NOT_FOUND", "source_item_id was not found in this lifecycle", 422);
  if (!value.source_anchor || !Object.keys(value.source_anchor).length) {
    throw typedError("SOURCE_ANCHOR_REQUIRED", `${value.item_type} requires a source_anchor`, 422);
  }
}

function validateTraceability(items) {
  const errors = [];
  const byId = new Map(items.map((item) => [item.quality_lifecycle_item_id, item]));
  for (const item of items) {
    if (item.item_type === "DOCUMENT") continue;
    if (!item.source_item_id || !byId.has(item.source_item_id)) {
      errors.push(`${item.item_type}:${item.resource_id} has no valid source item`);
    }
    if (!item.source_anchor || !Object.keys(item.source_anchor).length) {
      errors.push(`${item.item_type}:${item.resource_id} has no source anchor`);
    }
  }
  return errors;
}

function normalizeItem(input = {}) {
  const itemType = String(input.item_type || "").toUpperCase();
  const resourceId = String(input.resource_id || "").trim();
  const resourceVersion = String(input.resource_version || "current").trim();
  const sourceItemId = input.source_item_id ? String(input.source_item_id) : null;
  const approvalStatus = String(input.approval_status || "PENDING").toUpperCase();
  if (!ITEM_TYPES.includes(itemType)) throw typedError("LIFECYCLE_ITEM_TYPE_INVALID", `Unsupported item_type: ${itemType || "<empty>"}`, 422);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(resourceId)) throw typedError("LIFECYCLE_RESOURCE_ID_INVALID", "resource_id is invalid", 422);
  if (!/^[A-Za-z0-9._:+-]{1,128}$/.test(resourceVersion)) throw typedError("LIFECYCLE_RESOURCE_VERSION_INVALID", "resource_version is invalid", 422);
  if (sourceItemId && !/^[A-Za-z0-9._:-]{1,128}$/.test(sourceItemId)) throw typedError("LIFECYCLE_SOURCE_ITEM_INVALID", "source_item_id is invalid", 422);
  if (!["PENDING", "APPROVED", "REJECTED"].includes(approvalStatus)) throw typedError("LIFECYCLE_APPROVAL_STATUS_INVALID", "approval_status is invalid", 422);
  const sourceAnchor = redactSecrets(input.source_anchor || {});
  const generationMetadata = redactSecrets(input.generation_metadata || {});
  const contentHash = String(input.content_hash || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(contentHash)) throw typedError("LIFECYCLE_CONTENT_HASH_INVALID", "content_hash must be SHA-256", 422);
  return {
    item_type: itemType,
    resource_id: resourceId,
    resource_version: resourceVersion,
    source_item_id: sourceItemId,
    source_anchor: sourceAnchor,
    generation_metadata: generationMetadata,
    approval_status: approvalStatus,
    content_hash: contentHash,
  };
}

function normalizeGenerationPolicy(value = {}) {
  const normalized = redactSecrets(value);
  const platform = String(normalized.selected_platform || normalized.platform || "").toUpperCase();
  const projectMode = String(normalized.project_mode || "NEW").toUpperCase();
  if (!["WINDOWS", "LINUX", "ANDROID", "EMBEDDED"].includes(platform)) {
    throw typedError("QUALITY_PLATFORM_INVALID", "generation_policy.selected_platform must be WINDOWS, LINUX, ANDROID, or EMBEDDED", 422);
  }
  if (!["NEW", "EXISTING"].includes(projectMode)) {
    throw typedError("AUTOMATION_PROJECT_MODE_INVALID", "generation_policy.project_mode must be NEW or EXISTING", 422);
  }
  return { ...normalized, selected_platform: platform, project_mode: projectMode };
}

async function appendEvent(lifecycle, event, transaction) {
  await lifecycleModel().findByPk(lifecycle.quality_lifecycle_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const maximum = await eventModel().max("sequence_number", {
    where: { quality_lifecycle_id: lifecycle.quality_lifecycle_id },
    transaction,
  });
  const payload = redactSecrets(event.payload || {});
  return eventModel().create({
    quality_lifecycle_event_id: newId(),
    quality_lifecycle_id: lifecycle.quality_lifecycle_id,
    organization_id: lifecycle.organization_id,
    project_id: lifecycle.project_id,
    sequence_number: Number(maximum || 0) + 1,
    event_type: event.event_type,
    actor_type: event.actor_type || "SYSTEM",
    actor_id: event.actor_id || null,
    payload,
    payload_hash: sha256(canonicalJson(payload)),
    occurred_at: new Date(),
    created_by: event.actor_id || "quality-lifecycle",
  }, { transaction });
}

async function lockLifecycle(id, actor, transaction) {
  const lifecycle = await lifecycleModel().findOne({
    where: {
      quality_lifecycle_id: id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  return lifecycle;
}

async function requireLifecycle(id, actor) {
  const lifecycle = await getLifecycle(id, actor);
  if (!lifecycle) throw typedError("QUALITY_LIFECYCLE_NOT_FOUND", "Quality lifecycle was not found", 404);
  return lifecycle;
}

function defaultGenerationPolicy() {
  return {
    selected_platform: "WINDOWS",
    project_mode: "NEW",
    require_source_anchor: true,
    require_human_approval: true,
    generate_negative_cases: true,
    generate_boundary_cases: true,
    generate_recovery_cases: true,
    script_repair_maximum_attempts: 3,
  };
}

function defaultAcceptancePolicy() {
  return {
    real_execution_required: true,
    simulated_results_rejected: true,
    meaningful_actions_minimum: 1,
    meaningful_assertions_minimum: 1,
    evidence_required: true,
  };
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

function countBy(values, selector) {
  const output = {};
  for (const value of values) {
    const key = selector(value);
    output[key] = (output[key] || 0) + 1;
  }
  return output;
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

module.exports = {
  STATES,
  STAGES,
  ITEM_TYPES,
  normalizeGenerationPolicy,
  TRANSITIONS,
  createLifecycle,
  getLifecycle,
  listLifecycles,
  addItem,
  approveItem,
  transition,
  listItems,
  listEvents,
  getReadiness,
  evaluateReadiness,
  normalizeItem,
};
