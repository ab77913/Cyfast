"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const activityLogController = require("../controllers/activityLogController");

async function activityLogRoutes(fastify) {
  fastify.get("/:id", wrap(activityLogController.getLog));

  fastify.get("/", wrap(activityLogController.getLogs));
  fastify.post("/", wrap(activityLogController.createLog));
}

module.exports = activityLogRoutes;
