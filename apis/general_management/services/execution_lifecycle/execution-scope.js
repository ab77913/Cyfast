"use strict";

class ExecutionScopeError extends Error {
  constructor(code, message, statusCode = 403) {
    super(message);
    this.name = "ExecutionScopeError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => typeof entry === "object" ? entry.id || entry.projectId || entry.project_id : entry)
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function resolveExecutionScope(request, options = {}) {
  const principal = request.user || request.principal || request.auth || {};
  const organizationId = firstString(
    principal.organizationId,
    principal.organization_id,
    principal.orgId,
    principal.org_id,
    request.headers?.["x-organization-id"],
    request.body?.organizationId,
    request.query?.organizationId,
  );
  const projectId = firstString(
    request.params?.projectId,
    request.body?.projectId,
    request.query?.projectId,
    request.headers?.["x-project-id"],
    principal.projectId,
    principal.project_id,
  );
  const userId = firstString(
    principal.userId,
    principal.user_id,
    principal.id,
    principal.sub,
  );
  if (!userId && options.allowAnonymous !== true) {
    throw new ExecutionScopeError("UNAUTHENTICATED", "Authentication is required.", 401);
  }
  if (!organizationId) {
    throw new ExecutionScopeError(
      "ORGANIZATION_SCOPE_REQUIRED",
      "An organization scope is required.",
      400,
    );
  }
  if (!projectId) {
    throw new ExecutionScopeError("PROJECT_SCOPE_REQUIRED", "A project scope is required.", 400);
  }

  const principalOrganization = firstString(
    principal.organizationId,
    principal.organization_id,
    principal.orgId,
    principal.org_id,
  );
  if (principalOrganization && principalOrganization !== organizationId) {
    throw new ExecutionScopeError(
      "ORGANIZATION_SCOPE_FORBIDDEN",
      "The requested organization does not match the authenticated principal.",
    );
  }

  const roles = new Set(normalizeList(principal.roles).map((role) => role.toUpperCase()));
  const projectIds = normalizeList(
    principal.projectIds || principal.project_ids || principal.projects,
  );
  const organizationWide = [
    "SUPER_ADMIN",
    "ORG_ADMIN",
    "ORGANIZATION_ADMIN",
    "PROJECT_ADMIN_ALL",
  ].some((role) => roles.has(role));
  if (projectIds.length > 0 && !organizationWide && !projectIds.includes(projectId)) {
    throw new ExecutionScopeError(
      "PROJECT_SCOPE_FORBIDDEN",
      "The authenticated principal is not assigned to this project.",
    );
  }

  const bodyOrganization = firstString(request.body?.organizationId);
  const bodyProject = firstString(request.body?.projectId);
  if (bodyOrganization && bodyOrganization !== organizationId) {
    throw new ExecutionScopeError(
      "ORGANIZATION_BODY_SCOPE_MISMATCH",
      "Body organizationId does not match the authorized scope.",
      400,
    );
  }
  if (bodyProject && bodyProject !== projectId) {
    throw new ExecutionScopeError(
      "PROJECT_BODY_SCOPE_MISMATCH",
      "Body projectId does not match the authorized scope.",
      400,
    );
  }

  return Object.freeze({
    organizationId,
    projectId,
    userId,
    roles: [...roles],
    principal,
  });
}

module.exports = {
  ExecutionScopeError,
  resolveExecutionScope,
  normalizeList,
};
