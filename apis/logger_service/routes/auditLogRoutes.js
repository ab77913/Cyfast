"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const auditLogController = require("../controllers/auditLogController");

async function auditLogRoutes(fastify) {
  fastify.get("/:id", wrap(auditLogController.getLog));

  fastify.get("/", wrap(auditLogController.getLogs));
  fastify.post("/", wrap(auditLogController.createLog));
}

module.exports = auditLogRoutes;
