"use strict";

const authz = require("../services/execution/execution-authz");
const lifecycle = require("../services/quality-lifecycle-service");
const { ensureQualityLifecyclePermissions } = require("../services/quality-lifecycle-permission-bootstrap");
const { typedError } = require("../services/execution/execution-contract");

async function create(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.manage", projectId(request));
    return reply.code(201).send(await lifecycle.createLifecycle(request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function list(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    return reply.send(await lifecycle.listLifecycles(actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function get(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    const value = await lifecycle.getLifecycle(request.params.id, actor);
    return value ? reply.send(value) : reply.code(404).send({ code: "QUALITY_LIFECYCLE_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function addItem(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.manage", projectId(request));
    return reply.code(201).send(await lifecycle.addItem(request.params.id, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listItems(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    return reply.send(await lifecycle.listItems(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function approveItem(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.approve", projectId(request));
    return reply.send(await lifecycle.approveItem(request.params.id, request.params.itemId, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function transition(request, reply) {
  try {
    const permission = String(request.body?.status || "").toUpperCase().endsWith("_APPROVED")
      ? "quality_lifecycle.approve"
      : "quality_lifecycle.manage";
    const actor = await authz.requireProjectPermission(request, permission, projectId(request));
    return reply.send(await lifecycle.transition(
      request.params.id,
      request.body?.status,
      actor,
      request.body?.metadata || {},
    ));
  } catch (error) {
    return fail(reply, error);
  }
}

async function events(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    return reply.send(await lifecycle.listEvents(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function readiness(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    return reply.send(await lifecycle.getReadiness(request.params.id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function bootstrapPermissions(request, reply) {
  try {
    let organizationId;
    try {
      authz.assertInternal(request);
      organizationId = Number(request.body?.organization_id);
    } catch (_) {
      const actor = await authz.requirePermission(request, "quality_lifecycle.manage");
      organizationId = actor.organizationId;
    }
    if (!Number.isInteger(organizationId) || organizationId <= 0) throw typedError("INVALID_ORGANIZATION", "organization_id is required", 400);
    return reply.send(await ensureQualityLifecyclePermissions(
      organizationId,
      request.body?.assignToRoleName || "Super Admin",
    ));
  } catch (error) {
    return fail(reply, error);
  }
}

function projectId(request) {
  return request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
}

function fail(reply, error) {
  return reply.code(error.statusCode || 500).send({
    code: error.code || "QUALITY_LIFECYCLE_ERROR",
    message: error.message || "Quality lifecycle request failed",
  });
}

module.exports = {
  create,
  list,
  get,
  addItem,
  listItems,
  approveItem,
  transition,
  events,
  readiness,
  bootstrapPermissions,
};
