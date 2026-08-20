"use strict";

const crypto = require("crypto");
const db = require("../../database/mysql/models");
const { canonicalJson, sha256, redactSecrets, typedError } = require("./execution-contract");
const { parsePagination } = require("./execution-store");

const LINK_TYPES = Object.freeze([
  "DOCUMENT",
  "REQUIREMENT",
  "RISK",
  "TEST_SCENARIO",
  "TEST_CASE",
  "TEST_DATA",
  "TEST_SCRIPT",
  "APPLICATION",
  "DEVICE",
  "LOCATOR_SET",
  "AGENT",
  "DEFECT",
  "REPAIR",
  "PRODUCT_COMMIT",
  "REPORT",
]);

const RELATIONSHIPS = Object.freeze([
  "DERIVED_FROM",
  "VERIFIES",
  "USES",
  "EXECUTED_ON",
  "PRODUCED",
  "FAILED_WITH",
  "REPAIRED_BY",
  "RESOLVED_BY",
  "REPORTED_IN",
]);

function traceModel() {
  if (!db.ExecutionTraceLink) throw typedError("TRACE_MODEL_UNAVAILABLE", "ExecutionTraceLink model is unavailable", 500);
  return db.ExecutionTraceLink;
}

async function appendTraceLink(run, link, actor, transaction = null) {
  const normalized = normalizeTraceLink(link);
  const values = {
    execution_trace_link_id: crypto.randomUUID().replace(/-/g, ""),
    organization_id: run.organization_id,
    project_id: run.project_id,
    execution_run_id: run.execution_run_id,
    link_type: normalized.link_type,
    resource_id: normalized.resource_id,
    resource_version: normalized.resource_version,
    relationship: normalized.relationship,
    source_system: normalized.source_system,
    metadata: normalized.metadata,
    content_hash: sha256(canonicalJson({
      link_type: normalized.link_type,
      resource_id: normalized.resource_id,
      resource_version: normalized.resource_version,
      relationship: normalized.relationship,
      source_system: normalized.source_system,
      metadata: normalized.metadata,
    })),
    created_by: actor.userId || actor.actorId || "execution-traceability",
  };
  const [row] = await traceModel().findOrCreate({
    where: {
      execution_run_id: values.execution_run_id,
      link_type: values.link_type,
      resource_id: values.resource_id,
      resource_version: values.resource_version,
      relationship: values.relationship,
    },
    defaults: values,
    transaction,
  });
  return row;
}

async function appendTraceLinks(run, links, actor, transaction = null) {
  const output = [];
  for (const link of Array.isArray(links) ? links : []) {
    output.push(await appendTraceLink(run, link, actor, transaction));
  }
  return output;
}

async function listTraceLinks(runId, actor, query = {}) {
  const pagination = parsePagination(query, { defaultPageSize: 100 });
  const where = {
    execution_run_id: runId,
    organization_id: actor.organizationId,
    project_id: actor.projectId,
  };
  if (query.link_type) where.link_type = String(query.link_type).toUpperCase();
  const result = await traceModel().findAndCountAll({
    where,
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

async function buildTraceGraph(runId, actor) {
  const result = await listTraceLinks(runId, actor, { page: 1, page_size: 100 });
  const nodes = new Map();
  const edges = [];
  const runNodeId = `EXECUTION_RUN:${runId}`;
  nodes.set(runNodeId, { id: runNodeId, type: "EXECUTION_RUN", resource_id: runId });
  for (const row of result.items) {
    const value = row.toJSON ? row.toJSON() : row;
    const nodeId = `${value.link_type}:${value.resource_id}:${value.resource_version}`;
    nodes.set(nodeId, {
      id: nodeId,
      type: value.link_type,
      resource_id: value.resource_id,
      resource_version: value.resource_version,
      source_system: value.source_system,
      metadata: value.metadata,
    });
    edges.push({
      id: value.execution_trace_link_id,
      source: nodeId,
      target: runNodeId,
      relationship: value.relationship,
      content_hash: value.content_hash,
    });
  }
  return { nodes: [...nodes.values()], edges };
}

function normalizeTraceLink(value = {}) {
  const linkType = String(value.link_type || value.type || "").toUpperCase();
  const relationship = String(value.relationship || "USES").toUpperCase();
  const resourceId = String(value.resource_id || value.id || "").trim();
  const resourceVersion = String(value.resource_version || value.version || "current").trim();
  const sourceSystem = String(value.source_system || "CYFAST").trim().toUpperCase();
  if (!LINK_TYPES.includes(linkType)) throw typedError("TRACE_LINK_TYPE_INVALID", `Unsupported trace link type: ${linkType || "<empty>"}`, 422);
  if (!RELATIONSHIPS.includes(relationship)) throw typedError("TRACE_RELATIONSHIP_INVALID", `Unsupported trace relationship: ${relationship || "<empty>"}`, 422);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(resourceId)) throw typedError("TRACE_RESOURCE_ID_INVALID", "Trace resource_id is invalid", 422);
  if (!/^[A-Za-z0-9._:+-]{1,128}$/.test(resourceVersion)) throw typedError("TRACE_RESOURCE_VERSION_INVALID", "Trace resource_version is invalid", 422);
  if (!/^[A-Z0-9_-]{1,64}$/.test(sourceSystem)) throw typedError("TRACE_SOURCE_SYSTEM_INVALID", "Trace source_system is invalid", 422);
  return {
    link_type: linkType,
    resource_id: resourceId,
    resource_version: resourceVersion,
    relationship,
    source_system: sourceSystem,
    metadata: redactSecrets(value.metadata || {}),
  };
}

module.exports = {
  LINK_TYPES,
  RELATIONSHIPS,
  appendTraceLink,
  appendTraceLinks,
  listTraceLinks,
  buildTraceGraph,
  normalizeTraceLink,
};
