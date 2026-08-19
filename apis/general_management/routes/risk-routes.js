"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const riskController = require("../controllers/risk-controller");

async function riskRoutes(fastify) {
  fastify.get("/", wrap(riskController.getRisks));
  fastify.post("/", wrap(riskController.addRisk));
  
  fastify.get("/:riskId", wrap(riskController.getRisk));
  fastify.post("/:riskId", wrap(riskController.updateRisk));
  fastify.delete("/:riskId", wrap(riskController.deleteRisk));
}

module.exports = riskRoutes;
