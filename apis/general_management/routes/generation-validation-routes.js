"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const controller = require("../controllers/generation-validation-controller");

async function generationValidationRoutes(fastify) {
  fastify.post(
    "/requirements",
    wrap(controller.validateRequirements)
  );
  fastify.post("/test_cases", wrap(controller.validateTestCases));
  fastify.post("/test_scenarios", wrap(controller.validateTestScenarios));
  fastify.post("/other", wrap(controller.validateOther));
}

module.exports = generationValidationRoutes;
