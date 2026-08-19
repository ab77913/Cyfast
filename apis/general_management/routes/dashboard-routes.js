"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const dashboardController = require("../controllers/dashboard-controller");

async function dashboardRoutes(fastify) {
  fastify.get("/kpis", wrap(dashboardController.getKpis));
  fastify.get("/details", wrap(dashboardController.getDetails));
}

module.exports = dashboardRoutes;
