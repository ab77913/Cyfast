"use strict";

const controller = require("../controllers/quality-lifecycle-controller");

async function qualityLifecycleRoutes(fastify) {
  fastify.post("/quality_lifecycle_permissions/bootstrap", controller.bootstrapPermissions);
  fastify.post("/quality_lifecycles", controller.create);
  fastify.get("/quality_lifecycles", controller.list);
  fastify.get("/quality_lifecycles/:id", controller.get);
  fastify.post("/quality_lifecycles/:id/items", controller.addItem);
  fastify.get("/quality_lifecycles/:id/items", controller.listItems);
  fastify.post("/quality_lifecycles/:id/items/:itemId/approval", controller.approveItem);
  fastify.post("/quality_lifecycles/:id/transition", controller.transition);
  fastify.get("/quality_lifecycles/:id/events", controller.events);
  fastify.get("/quality_lifecycles/:id/readiness", controller.readiness);
}

module.exports = qualityLifecycleRoutes;
