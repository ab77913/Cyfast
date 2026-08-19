"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testScriptController = require("../controllers/test-script-controller");

async function testScriptRoutes(fastify) {
  fastify.get("/", wrap(testScriptController.getTestScripts));
  fastify.post("/", wrap(testScriptController.addTestScript));
  
  fastify.get("/:testScriptId", wrap(testScriptController.getTestScript));
  fastify.post("/:testScriptId", wrap(testScriptController.updateTestScript));
  fastify.delete("/:testScriptId", wrap(testScriptController.deleteTestScript));
}

module.exports = testScriptRoutes;
