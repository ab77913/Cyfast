"use strict";

const controller = require("../controllers/execution-metrics-controller");

async function executionMetricsRoutes(fastify) {
  fastify.get("/execution_metrics", controller.get);
}

module.exports = executionMetricsRoutes;
