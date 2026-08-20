"use strict";

const authz = require("../services/execution/execution-authz");
const service = require("../services/quality-lifecycle-content-service");

async function create(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.manage", projectId(request));
    return reply.code(201).send(await service.createContentItem(request.params.id, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function list(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    return reply.send(await service.listContents(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function get(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.read", projectId(request));
    const value = await service.getContent(request.params.contentId, actor);
    return value
      ? reply.send(value)
      : reply.code(404).send({ code: "QUALITY_CONTENT_NOT_FOUND", message: "Lifecycle content was not found" });
  } catch (error) {
    return fail(reply, error);
  }
}

function projectId(request) {
  return request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
}

function fail(reply, error) {
  return reply.code(error.statusCode || 500).send({
    code: error.code || "QUALITY_CONTENT_ERROR",
    message: error.message || "Quality content request failed",
  });
}

module.exports = { create, list, get };
