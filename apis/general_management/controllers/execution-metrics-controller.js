"use strict";

const authz = require("../services/execution/execution-authz");
const metrics = require("../services/execution/execution-metrics-service");

async function get(request, reply) {
  try {
    const projectId = request.query?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId);
    return reply.send(await metrics.getMetrics(actor, request.query));
  } catch (error) {
    return reply.code(error.statusCode || 500).send({
      code: error.code || "EXECUTION_METRICS_ERROR",
      message: error.message || "Execution metrics request failed",
    });
  }
}

module.exports = { get };
