"use strict";

const permissionController = require("../controllers/permission-controller");

async function permissionRoutes(fastify) {
  fastify.get("/", permissionController.getPermissions);
  fastify.get("/:permissionId", { schema: { params: { type: "object", properties: { permissionId: { type: "integer" } } } } }, permissionController.getPermission);
  fastify.post("/", permissionController.addPermission);
  fastify.post("/:permissionId", { schema: { params: { type: "object", properties: { permissionId: { type: "integer" } } } } }, permissionController.updatePermission);
  fastify.delete("/:permissionId", { schema: { params: { type: "object", properties: { permissionId: { type: "integer" } } } } }, permissionController.deletePermission);
}

module.exports = permissionRoutes;
