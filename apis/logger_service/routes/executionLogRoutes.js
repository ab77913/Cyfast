"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const { executionLogUploadPreHandler } = require("../middlewares/fastify-execution-log-upload");
const executionLogController = require("../controllers/executionLogController");

async function executionLogRoutes(fastify) {
  fastify.get(
    "/orchestration_execution/:execution_id/reports/download/all",
    wrap(executionLogController.downloadOrchestrationExecutionReports),
  );
  fastify.get(
    "/orchestration_execution/:execution_id/reports/:report_file",
    wrap(executionLogController.getOrchestrationExecutionReport),
  );
  fastify.get(
    "/orchestration_execution/:execution_id",
    wrap(executionLogController.getOrchestrationExecutionLogs),
  );

  fastify.post(
    "/upload",
    { preHandler: executionLogUploadPreHandler },
    wrap(executionLogController.uploadLog),
  );

  fastify.get("/:id", wrap(executionLogController.getLog));

  fastify.get("/", wrap(executionLogController.getLogs));
  fastify.post("/", wrap(executionLogController.createLog));
}

module.exports = executionLogRoutes;
