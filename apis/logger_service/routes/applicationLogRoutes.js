"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const applicationLogController = require("../controllers/applicationLogController");

async function applicationLogRoutes(fastify) {
  fastify.get("/:id", wrap(applicationLogController.getLog));

  fastify.get("/", wrap(applicationLogController.getLogs));
  fastify.post("/", wrap(applicationLogController.createLog));
}

module.exports = applicationLogRoutes;
