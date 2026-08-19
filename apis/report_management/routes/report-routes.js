"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const reportController = require("../controllers/report-controller");

async function reportRoutes(fastify) {
  fastify.get("/generate", wrap(reportController.generateReport));
  fastify.get("/download", wrap(reportController.downloadReport));
  fastify.post("/preview", wrap(reportController.previewReport));
  fastify.get("/wordtoword", wrap(reportController.wordToWord));
}

module.exports = reportRoutes;
