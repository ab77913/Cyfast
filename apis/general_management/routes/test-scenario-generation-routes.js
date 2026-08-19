"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const testScenarioGenerationController = require("../controllers/test-scenario-generation-controller");

async function testScenarioGenerationRoutes(fastify) {
  fastify.post(
    "/candidates/bulk_approve",
    wrap(testScenarioGenerationController.bulkApprove),
  );
  fastify.post(
    "/candidates/bulk_reject",
    wrap(testScenarioGenerationController.bulkReject),
  );
  fastify.post(
    "/candidates/bulk_discard",
    wrap(testScenarioGenerationController.bulkDiscard),
  );
  fastify.post(
    "/candidates/regenerate",
    wrap(testScenarioGenerationController.regenerateSelectedCandidates),
  );

  fastify.post(
    "/jobs/bulk_regenerate",
    wrap(testScenarioGenerationController.bulkRegenerateJobs),
  );
  fastify.post(
    "/jobs/discard_pending",
    wrap(testScenarioGenerationController.discardPendingJobs),
  );

  fastify.get("/pending", wrap(testScenarioGenerationController.listPending));
  fastify.get("/jobs/:jobId", wrap(testScenarioGenerationController.getJob));
  fastify.post(
    "/jobs/:jobId/regenerate",
    wrap(testScenarioGenerationController.regenerateJob),
  );
  fastify.get("/jobs", wrap(testScenarioGenerationController.listJobs));
  fastify.post("/jobs", wrap(testScenarioGenerationController.createJob));
  fastify.post(
    "/candidates/:candidateId/approve",
    wrap(testScenarioGenerationController.approveCandidate),
  );
  fastify.post(
    "/candidates/:candidateId/reject",
    wrap(testScenarioGenerationController.rejectCandidate),
  );
}

module.exports = testScenarioGenerationRoutes;
