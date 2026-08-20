"use strict";

const authz = require("../services/execution/execution-authz");
const orchestrator = require("../services/quality-generation-orchestrator");

async function generate(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.manage", projectId(request));
    return reply.code(201).send(await orchestrator.generateNextStage(request.params.id, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function validateScripts(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "quality_lifecycle.approve", projectId(request));
    return reply.send(await orchestrator.validateGeneratedScripts(request.params.id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

function projectId(request) {
  return request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
}

function fail(reply, error) {
  return reply.code(error.statusCode || error.response?.status || 500).send({
    code: error.code || error.response?.data?.detail?.code || "QUALITY_GENERATION_ERROR",
    message: error.message || error.response?.data?.detail?.message || "Quality generation request failed",
    details: error.response?.data?.detail || undefined,
  });
}

module.exports = { generate, validateScripts };
