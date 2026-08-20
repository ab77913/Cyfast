"use strict";

const authz = require("../services/execution/execution-authz");
const service = require("../services/execution/execution-product-verification-service");

async function start(request, reply) {
  try {
    const projectId = request.body?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_run.create", projectId);
    const idempotencyKey = request.headers["idempotency-key"] || request.body?.idempotency_key;
    return reply.code(202).send(await service.startVerificationRerun(
      request.params.fixId,
      { ...(request.body || {}), idempotency_key: idempotencyKey },
      actor,
    ));
  } catch (error) {
    return reply.code(error.statusCode || 500).send({
      code: error.code || "PRODUCT_FIX_VERIFICATION_ERROR",
      message: error.message || "Product fix verification could not be started",
    });
  }
}

module.exports = { start };
