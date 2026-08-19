"use strict";

const authController = require("../controllers/auth-controller");

async function authRoutes(fastify) {
  fastify.get("/me", authController.getCurrentUser);
  fastify.post("/login", authController.login);
  fastify.post("/logout", authController.logout);
  fastify.post("/forgot_password", authController.forgotPassword);
  fastify.post("/reset_password", authController.resetPassword);
}

module.exports = authRoutes;
