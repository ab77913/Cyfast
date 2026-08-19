"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testCaseController = require("../controllers/test-case-controller");
const testCaseGenerationController = require("../controllers/test-case-generation-controller");

async function testCaseRoutes(fastify) {
  fastify.post("/generate", wrap(testCaseGenerationController.generate));
  fastify.get(
    "/generate/jobs/:jobId",
    wrap(testCaseGenerationController.getGenerationJob),
  );
  fastify.get("/pending", wrap(testCaseGenerationController.listPending));
  fastify.post(
    "/generated/approve-batch",
    wrap(testCaseGenerationController.approveBatch),
  );
  fastify.post(
    "/generated/reject-batch",
    wrap(testCaseGenerationController.rejectBatch),
  );
  fastify.post(
    "/generated/discard-batch",
    wrap(testCaseGenerationController.bulkDiscard),
  );
  fastify.post(
    "/generated/regenerate",
    wrap(testCaseGenerationController.regenerateSelectedCandidates),
  );
  fastify.post(
    "/generate/jobs/discard_pending",
    wrap(testCaseGenerationController.discardPendingJobs),
  );
  fastify.post(
    "/generated/:generatedId/approve",
    wrap(testCaseGenerationController.approveGenerated),
  );
  fastify.post(
    "/generated/:generatedId/reject",
    wrap(testCaseGenerationController.rejectGenerated),
  );

  fastify.get("/", wrap(testCaseController.getTestCases));
  fastify.post("/", wrap(testCaseController.addTestCase));

  fastify.post(
    "/:testCaseId/start_execution",
    wrap(testCaseController.startExecution),
  );

  fastify.get("/:testCaseId", wrap(testCaseController.getTestCase));
  fastify.post("/:testCaseId", wrap(testCaseController.updateTestCase));
  fastify.delete("/:testCaseId", wrap(testCaseController.deleteTestCase));
}

module.exports = testCaseRoutes;
