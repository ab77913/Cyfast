"use strict";

const controller = require("../controllers/quality-lifecycle-content-controller");

async function qualityLifecycleContentRoutes(fastify) {
  fastify.post("/quality_lifecycles/:id/content_items", controller.create);
  fastify.get("/quality_lifecycles/:id/contents", controller.list);
  fastify.get("/quality_lifecycle_contents/:contentId", controller.get);
}

module.exports = qualityLifecycleContentRoutes;
