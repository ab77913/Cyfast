"use strict";

const controller = require("../controllers/execution-product-fix-controller");

async function executionProductFixRoutes(fastify) {
  fastify.get("/execution_runs/:id/product_fixes", controller.list);
  fastify.post("/execution_defects/:defectId/product_fixes", controller.create);
  fastify.post("/execution_product_fixes/:fixId/review", controller.review);
  fastify.post("/execution_product_fixes/:fixId/deployment", controller.deployment);
  fastify.post("/execution_product_fixes/:fixId/verification", controller.verification);
}

module.exports = executionProductFixRoutes;
