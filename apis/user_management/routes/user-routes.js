"use strict";

const userController = require("../controllers/user-controller");
const roleController = require("../controllers/role-controller");

async function userRoutes(fastify) {
  fastify.get("/", userController.getUsers);
  fastify.post("/", userController.addUser);
  fastify.get("/my-profile", userController.getMyProfile);
  fastify.get("/roles/simple", roleController.listRoles);
  fastify.get("/:userId", { schema: { params: { type: "object", properties: { userId: { type: "integer" } } } } }, userController.getUser);
  fastify.post("/:userId", { schema: { params: { type: "object", properties: { userId: { type: "integer" } } } } }, userController.updateUser);
  fastify.put("/:userId", { schema: { params: { type: "object", properties: { userId: { type: "integer" } } } } }, userController.updateUser);
  fastify.delete("/:userId", { schema: { params: { type: "object", properties: { userId: { type: "integer" } } } } }, userController.deleteUser);
}

module.exports = userRoutes;
