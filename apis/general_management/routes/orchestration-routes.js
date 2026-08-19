"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const orchestrationController = require("../controllers/orchestration-controller");
const orchestrationConfigurationController = require("../controllers/orchestration-configuration-controller");
const orchestrationExecutionController = require("../controllers/orchestration-execution-controller");

async function orchestrationRoutes(fastify) {
  fastify.get("/", wrap(orchestrationController.getOrchestrations));
  fastify.post("/", wrap(orchestrationController.addOrchestration));
  
  fastify.get(
    "/:orchestrationId/test_cases/executions",
    wrap(orchestrationController.getTestCaseExecutions),
  );
  fastify.get(
    "/:orchestrationId/test_cases",
    wrap(orchestrationController.getTestCases),
  );
  fastify.post(
    "/:orchestrationId/test_cases",
    wrap(orchestrationController.updateTestCases),
  );

  fastify.post(
    "/:orchestrationId/configurations/:projectConfigurationId",
    wrap(orchestrationConfigurationController.updateConfiguration),
  );
  fastify.get(
    "/:orchestrationId/configurations",
    wrap(orchestrationConfigurationController.getConfigurations),
  );
  fastify.post(
    "/:orchestrationId/configurations",
    wrap(orchestrationConfigurationController.addConfiguration),
  );
  fastify.delete(
    "/:orchestrationId/configurations",
    wrap(orchestrationConfigurationController.deleteConfigurations),
  );

  fastify.get(
    "/:orchestrationId/executions/trends",
    wrap(orchestrationExecutionController.getExecutionTrends),
  );
  fastify.get(
    "/:orchestrationId/executions/statistics",
    wrap(orchestrationExecutionController.getExecutionStats),
  );
  fastify.get(
    "/:orchestrationId/executions/latest",
    wrap(orchestrationController.getLatestExecution),
  );
  fastify.get(
    "/:orchestrationId/executions",
    wrap(orchestrationController.getExecutions),
  );

  fastify.post(
    "/:orchestrationId/start_execution",
    wrap(orchestrationController.startExecution),
  );
  fastify.post(
    "/:orchestrationId/pause_execution",
    wrap(orchestrationController.pauseExecution),
  );
  fastify.post(
    "/:orchestrationId/resume_execution",
    wrap(orchestrationController.resumeExecution),
  );
  fastify.post(
    "/:orchestrationId/stop_execution",
    wrap(orchestrationController.stopExecution),
  );

  fastify.get(
    "/:orchestrationId",
    wrap(orchestrationController.getOrchestration),
  );
  fastify.post(
    "/:orchestrationId",
    wrap(orchestrationController.updateOrchestration),
  );
  fastify.delete(
    "/:orchestrationId",
    wrap(orchestrationController.deleteOrchestration),
  );

  
}

module.exports = orchestrationRoutes;
