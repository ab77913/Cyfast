"use strict";

const authz = require("../services/execution/execution-authz");
const service = require("../services/quality-lifecycle-execution-service");

async function start(request, reply) {
  try {
    const projectId = request.body?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_run.create", projectId);
    const idempotencyKey = request.headers["idempotency-key"] || request.body?.idempotency_key;
    const result = await service.startLifecycleExecution(
      request.params.id,
      { ...(request.body || {}), idempotency_key: idempotencyKey },
      actor,
    );
    return reply.code(202).send(result);
  } catch (error) {
    return reply.code(error.statusCode || 500).send({
      code: error.code || "QUALITY_LIFECYCLE_EXECUTION_ERROR",
      message: error.message || "Lifecycle execution could not be started",
    });
  }
}

async function list(request, reply) {
  try {
    const projectId = request.query?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId);
    return reply.send(await service.listLifecycleExecutions(request.params.id, actor, request.query));
  } catch (error) {
    return reply.code(error.statusCode || 500).send({
      code: error.code || "QUALITY_LIFECYCLE_EXECUTION_ERROR",
      message: error.message || "Lifecycle executions could not be listed",
    });
  }
}

module.exports = { start, list };
