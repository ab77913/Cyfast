"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const controller = require("../controllers/user-notification-controller");

async function userNotificationRoutes(fastify) {
  fastify.get("/me", wrap(controller.listMine));
  fastify.post("/me/read_all", wrap(controller.readAll));
  fastify.post("/:notificationId/read", wrap(controller.readOne));
}

module.exports = userNotificationRoutes;
