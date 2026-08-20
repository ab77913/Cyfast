"use strict";

const controller = require("../controllers/platform-execution-controller");
const artifactController = require("../controllers/execution-artifact-content-controller");

async function platformExecutionRoutes(fastify) {
  fastify.post("/execution_permissions/bootstrap", controller.bootstrapPermissions);

  fastify.post("/execution_targets", controller.createTarget);
  fastify.get("/execution_targets", controller.listTargets);
  fastify.get("/execution_targets/:id", controller.getTarget);
  fastify.post("/execution_targets/:id/check", controller.checkTarget);
  fastify.post("/execution_targets/:id/revoke", controller.revokeTarget);

  fastify.post("/execution_runs", controller.startRun);
  fastify.get("/execution_runs", controller.listRuns);
  fastify.get("/execution_runs/:id", controller.getRun);
  fastify.post("/execution_runs/:id/cancel", controller.cancelRun);
  fastify.get("/execution_runs/:id/events", controller.listEvents);
  fastify.get("/execution_runs/:id/artifacts", controller.listArtifacts);
  fastify.get("/execution_runs/:id/recordings", controller.listRecordings);
  fastify.get("/execution_runs/:id/defects", controller.listDefects);
  fastify.get("/execution_runs/:id/repairs", controller.listRepairs);
  fastify.post("/execution_runs/:id/repairs", controller.proposeRepair);
  fastify.post("/execution_runs/:id/repairs/:repairId/approve-and-rerun", controller.approveRepairAndRerun);

  fastify.patch("/execution_defects/:id", controller.updateDefect);
  fastify.get("/execution_artifacts/:id/content", artifactController.artifactContent);

  // Internal target callbacks use the existing service-to-service bearer token.
  fastify.post("/internal/execution_runs/:id/result", controller.ingestResult);
  fastify.post("/internal/execution_targets/:id/health", controller.updateTargetHealthInternal);
}

module.exports = platformExecutionRoutes;
