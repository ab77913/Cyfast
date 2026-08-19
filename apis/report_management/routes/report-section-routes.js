"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const reportSectionController = require("../controllers/report-section-controller");

async function reportSectionRoutes(fastify) {
  fastify.post("/add_default", wrap(reportSectionController.addDefaultReportSections));

  fastify.get("/", wrap(reportSectionController.getReportSections));
  fastify.post("/", wrap(reportSectionController.addReportSection));

  fastify.get("/:reportSectionId", wrap(reportSectionController.getReportSection));
  fastify.post("/:reportSectionId", wrap(reportSectionController.updateReportSection));
  fastify.delete(
    "/:reportSectionId",
    wrap(reportSectionController.deleteReportSection),
  );
}

module.exports = reportSectionRoutes;
