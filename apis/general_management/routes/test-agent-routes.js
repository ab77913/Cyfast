"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testAgentController = require("../controllers/test-agent-controller");

async function testAgentRoutes(fastify) {
  fastify.get("/", wrap(testAgentController.getTestAgents));

  fastify.post("/bulk_delete", wrap(testAgentController.bulkDeleteTestAgents));
  fastify.post("/bulk_map_projects", wrap(testAgentController.bulkMapProjects));

  fastify.post("/:testAgentId/stop", wrap(testAgentController.stopTestAgent));
  fastify.post("/:testAgentId/projects", wrap(testAgentController.mapProjects));

  fastify.get("/:testAgentId", wrap(testAgentController.getTestAgent));
  fastify.delete("/:testAgentId", wrap(testAgentController.deleteTestAgent));
}

module.exports = testAgentRoutes;
