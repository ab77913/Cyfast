"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const reportTemplateController = require("../controllers/report-template-controller");

async function reportTemplateRoutes(fastify) {
  fastify.post(
    "/:reportTemplateId/set_default",
    wrap(reportTemplateController.setDefaultReportTemplate),
  );

  fastify.get("/:reportTemplateId", wrap(reportTemplateController.getReportTemplate));
  fastify.post("/:reportTemplateId", wrap(reportTemplateController.updateReportTemplate));
  fastify.delete(
    "/:reportTemplateId",
    wrap(reportTemplateController.deleteReportTemplate),
  );

  fastify.get("/", wrap(reportTemplateController.getReportTemplates));
  fastify.post("/", wrap(reportTemplateController.createReportTemplate));
}

module.exports = reportTemplateRoutes;
