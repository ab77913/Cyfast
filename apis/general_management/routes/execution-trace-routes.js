"use strict";

const controller = require("../controllers/execution-trace-controller");

async function executionTraceRoutes(fastify) {
  fastify.get("/execution_runs/:id/traceability", controller.list);
  fastify.get("/execution_runs/:id/traceability/graph", controller.graph);
  fastify.post("/internal/execution_runs/:id/traceability", controller.appendInternal);
}

module.exports = executionTraceRoutes;
