"use strict";

const authz = require("../services/execution/execution-authz");
const service = require("../services/execution/execution-ai-repair-service");

async function propose(request, reply) {
  try {
    const projectId = request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_repair.propose", projectId);
    return reply.code(201).send(await service.proposeAiRepair(request.params.id, actor));
  } catch (error) {
    const status = error.statusCode || error.response?.status || 500;
    return reply.code(status).send({
      code: error.code || error.response?.data?.detail?.code || "AI_REPAIR_ERROR",
      message: error.message || error.response?.data?.detail?.message || "AI repair proposal failed",
      details: error.response?.data?.detail || undefined,
    });
  }
}

module.exports = { propose };
