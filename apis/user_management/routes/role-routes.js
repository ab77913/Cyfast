"use strict";

const roleController = require("../controllers/role-controller");

async function roleRoutes(fastify) {
  fastify.get("/", roleController.getRoles);
  fastify.get("/roles/simple", roleController.listRoles);
  fastify.get("/:roleId", roleController.getRole);
  fastify.post("/", roleController.addRole);
  fastify.post("/:roleId", roleController.updateRole);
  fastify.delete("/:roleId", roleController.deleteRole);
}

module.exports = roleRoutes;
