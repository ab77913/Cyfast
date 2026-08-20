"use strict";

const controller = require("../controllers/execution-product-verification-controller");

async function executionProductVerificationRoutes(fastify) {
  fastify.post("/execution_product_fixes/:fixId/verification_rerun", controller.start);
}

module.exports = executionProductVerificationRoutes;
