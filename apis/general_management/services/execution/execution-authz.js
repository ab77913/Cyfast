"use strict";

const db = require("../../database/mysql/models");
const { assertInternalAuth } = require("../windows/windows-security-config");
const { typedError } = require("./execution-contract");

function principal(request) {
  const userId = request.headers["x-user-id"];
  const organizationId = Number(request.headers["x-organization-id"] || request.headers["organization-id"]);
  if (!userId || !Number.isInteger(organizationId) || organizationId <= 0) {
    throw typedError("UNAUTHENTICATED", "x-user-id and x-organization-id are required", 401);
  }
  return { userId: String(userId), organizationId };
}

async function requirePermission(request, permission) {
  const actor = principal(request);
  const rows = await db.sequelize.query(
    `SELECT 1
     FROM user_role ur
     JOIN role_permission rp
       ON rp.role_id = ur.role_id AND rp.organization_id = ur.organization_id
     JOIN permission p
       ON p.permission_id = rp.permission_id AND p.organization_id = rp.organization_id
     WHERE ur.user_id = :userId
       AND ur.organization_id = :organizationId
       AND p.name = :permission
       AND p.is_active = 1
       AND p.deleted_date IS NULL
       AND rp.deleted_date IS NULL
       AND ur.deleted_date IS NULL
     LIMIT 1`,
    {
      replacements: { userId: Number(actor.userId), organizationId: actor.organizationId, permission },
      type: db.Sequelize.QueryTypes.SELECT,
    },
  );
  if (!rows.length) throw typedError("FORBIDDEN", `Permission denied: ${permission}`, 403);
  return actor;
}

async function requireProjectPermission(request, permission, projectId) {
  const actor = await requirePermission(request, permission);
  const normalizedProjectId = Number(projectId);
  if (!Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    throw typedError("INVALID_PROJECT", "project_id must be a positive integer", 400);
  }

  const rows = await db.sequelize.query(
    `SELECT project_id
     FROM project
     WHERE project_id = :projectId
       AND organization_id = :organizationId
       AND deleted_date IS NULL
     LIMIT 1`,
    {
      replacements: { projectId: normalizedProjectId, organizationId: actor.organizationId },
      type: db.Sequelize.QueryTypes.SELECT,
    },
  );
  if (!rows.length) throw typedError("PROJECT_NOT_FOUND", "Project was not found in the caller organization", 404);
  return { ...actor, projectId: normalizedProjectId };
}

function assertResourceScope(actor, resource) {
  if (!resource || Number(resource.organization_id) !== Number(actor.organizationId)) {
    throw typedError("RESOURCE_NOT_FOUND", "Resource was not found", 404);
  }
  if (actor.projectId !== undefined && Number(resource.project_id) !== Number(actor.projectId)) {
    throw typedError("RESOURCE_NOT_FOUND", "Resource was not found in the requested project", 404);
  }
  return resource;
}

function assertInternal(request) {
  assertInternalAuth(request.headers.authorization);
  return { actorType: "AGENT", actorId: request.headers["x-agent-id"] || "internal-agent" };
}

module.exports = {
  principal,
  requirePermission,
  requireProjectPermission,
  assertResourceScope,
  assertInternal,
};
