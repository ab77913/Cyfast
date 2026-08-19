"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const requirementGenerationController = require("../controllers/requirement-generation-controller");

async function requirementGenerationRoutes(fastify) {
  fastify.post(
    "/candidates/bulk_approve",
    wrap(requirementGenerationController.bulkApprove)
  );
  fastify.post(
    "/candidates/bulk_reject",
    wrap(requirementGenerationController.bulkReject)
  );
  fastify.post(
    "/candidates/bulk_discard",
    wrap(requirementGenerationController.bulkDiscard)
  );
  fastify.post(
    "/candidates/regenerate",
    wrap(requirementGenerationController.regenerateSelectedCandidates)
  );

  fastify.post(
    "/jobs/bulk_regenerate",
    wrap(requirementGenerationController.bulkRegenerateJobs)
  );
  fastify.post(
    "/jobs/discard_pending",
    wrap(requirementGenerationController.discardPendingJobs)
  );

  fastify.get("/pending", wrap(requirementGenerationController.listPending));
  fastify.get("/jobs/:jobId", wrap(requirementGenerationController.getJob));
  fastify.post(
    "/jobs/:jobId/regenerate",
    wrap(requirementGenerationController.regenerateJob)
  );
  fastify.get("/jobs", wrap(requirementGenerationController.listJobs));
  fastify.post("/jobs", wrap(requirementGenerationController.createJob));
  fastify.post(
    "/candidates/:candidateId/approve",
    wrap(requirementGenerationController.approveCandidate)
  );
  fastify.post(
    "/candidates/:candidateId/reject",
    wrap(requirementGenerationController.rejectCandidate)
  );
}

module.exports = requirementGenerationRoutes;
