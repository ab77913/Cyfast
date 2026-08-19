"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testSourceController = require("../controllers/test-source-controller");

async function testSourceRoutes(fastify) {
  fastify.get("/", wrap(testSourceController.getTestSources));
  fastify.post("/", wrap(testSourceController.addTestSource));
  
  fastify.post(
    "/:testSourceId/import",
    wrap(testSourceController.importTestCases),
  );

  fastify.get("/:testSourceId", wrap(testSourceController.getTestSource));
  fastify.post("/:testSourceId", wrap(testSourceController.updateTestSource));
  fastify.delete("/:testSourceId", wrap(testSourceController.deleteTestSource));
}

module.exports = testSourceRoutes;
