"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testSuiteController = require("../controllers/test-suite-controller");

async function testSuiteRoutes(fastify) {
  fastify.get("/", wrap(testSuiteController.getTestSuites));
  fastify.post("/", wrap(testSuiteController.addTestSuite));
  
  fastify.get("/:testSuiteId", wrap(testSuiteController.getTestSuite));
  fastify.post("/:testSuiteId", wrap(testSuiteController.updateTestSuite));
  fastify.delete("/:testSuiteId", wrap(testSuiteController.deleteTestSuite));
}

module.exports = testSuiteRoutes;
