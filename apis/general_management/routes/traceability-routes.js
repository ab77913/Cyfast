"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const { traceabilityUploadPreHandler } = require("../middlewares/fastify-traceability-upload");
const traceabilityController = require("../controllers/traceability-controller");

async function traceabilityRoutes(fastify) {
  fastify.get("/", wrap(traceabilityController.getTraceability));
  
  fastify.get("/end_to_end", wrap(traceabilityController.getEndToEndTraceability));
  fastify.get("/imports", wrap(traceabilityController.getImports));
  fastify.get("/insights", wrap(traceabilityController.insights));
  fastify.get("/statistics", wrap(traceabilityController.statistics));
  fastify.get("/export", wrap(traceabilityController.exportTraceability));
  fastify.post(
    "/import",
    { preHandler: traceabilityUploadPreHandler },
    wrap(traceabilityController.importTraceability),
  );
  fastify.post("/import/resume", wrap(traceabilityController.resumeImport));
  fastify.post("/import/discard", wrap(traceabilityController.discardImport));
}

module.exports = traceabilityRoutes;
