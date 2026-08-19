"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const projectController = require("../controllers/project-controller");
const projectExecutionController = require("../controllers/project-execution-controller");

async function projectRoutes(fastify) {
  fastify.get("/", wrap(projectController.getProjects));
  fastify.post("/", wrap(projectController.addProject));
  
  fastify.delete(
    "/:projectId/test_agents/:testAgentId",
    wrap(projectController.detachTestAgent),
  );

  fastify.get(
    "/:projectId/executions/statistics/requirement_wise",
    wrap(projectExecutionController.getRequirementExecutionStats),
  );
  fastify.get(
    "/:projectId/executions/statistics",
    wrap(projectExecutionController.getExecutionStats),
  );
  fastify.get(
    "/:projectId/executions/top_failures",
    wrap(projectExecutionController.getTopFailureExecutions),
  );
  fastify.get(
    "/:projectId/executions/total_duration",
    wrap(projectExecutionController.getExecutionDuration),
  );
  fastify.get(
    "/:projectId/executions/latest",
    wrap(projectExecutionController.getLatestExecutions),
  );
  fastify.get(
    "/:projectId/executions",
    wrap(projectExecutionController.getExecutions),
  );

  fastify.get(
    "/:projectId/configuration",
    wrap(projectController.getConfiguration),
  );
  fastify.post(
    "/:projectId/configuration",
    wrap(projectController.updateConfiguration),
  );
  fastify.delete(
    "/:projectId/configuration",
    wrap(projectController.deleteConfiguration),
  );

  fastify.get(
    "/:projectId/test_agents",
    wrap(projectController.getTestAgents),
  );
  fastify.post(
    "/:projectId/test_agents",
    wrap(projectController.updateTestAgents),
  );

  fastify.get("/:projectId/summary", wrap(projectController.getProjectSummary));

  fastify.get("/:projectId", wrap(projectController.getProject));
  fastify.post("/:projectId", wrap(projectController.updateProject));
  fastify.delete("/:projectId", wrap(projectController.deleteProject));

  
}

module.exports = projectRoutes;
