"use strict";

const controller = require("../controllers/execution-ai-repair-controller");

async function executionAiRepairRoutes(fastify) {
  fastify.post("/execution_runs/:id/ai_repair", controller.propose);
}

module.exports = executionAiRepairRoutes;
