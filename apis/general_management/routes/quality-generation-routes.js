"use strict";

const controller = require("../controllers/quality-generation-controller");

async function qualityGenerationRoutes(fastify) {
  fastify.post("/quality_lifecycles/:id/generate", controller.generate);
  fastify.post("/quality_lifecycles/:id/validate_scripts", controller.validateScripts);
}

module.exports = qualityGenerationRoutes;
