"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testScenarioController = require("../controllers/test-scenario-controller");

async function testScenarioRoutes(fastify) {
  fastify.get("/", wrap(testScenarioController.getTestScenarios));
  fastify.get("/:testScenarioId", wrap(testScenarioController.getTestScenario));
}

module.exports = testScenarioRoutes;
