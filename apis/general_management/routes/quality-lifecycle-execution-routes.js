"use strict";

const controller = require("../controllers/quality-lifecycle-execution-controller");

async function qualityLifecycleExecutionRoutes(fastify) {
  fastify.post("/quality_lifecycles/:id/executions", controller.start);
  fastify.get("/quality_lifecycles/:id/executions", controller.list);
}

module.exports = qualityLifecycleExecutionRoutes;
