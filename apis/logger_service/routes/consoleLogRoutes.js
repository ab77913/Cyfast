"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const consoleLogController = require("../controllers/consoleLogController");

async function consoleLogRoutes(fastify) {
  fastify.post("/publish", wrap(consoleLogController.publishLog));

  fastify.get("/:id", wrap(consoleLogController.getLog));

  fastify.get("/", wrap(consoleLogController.getLogs));
  fastify.post("/", wrap(consoleLogController.createLog));
}

module.exports = consoleLogRoutes;
