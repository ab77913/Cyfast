/**
 * Authentication middleware for Fastify applications.
 * Provides hooks for JWT authentication and permission-based authorization.
 * @module middlewares/auth
 * @requires jsonwebtoken
 * @requires config
 * @requires userFactory
 * @requires authService
 */

"use strict";
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const userFactory = require("../database/" +
  config.db_type_primary +
  "/factories/user-factory");
const authService = require("../services/auth-service");

/**
 * Fastify onRequest hook to authenticate requests using JWT.
 * Verifies the Bearer token from the Authorization header and
 * attaches the user to `request.user`.
 * @function authenticate
 * @param {Object} request - The Fastify request object.
 * @param {Object} reply - The Fastify reply object.
 */
const authenticate = async (request, reply) => {
  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return reply.code(401).send({ message: "Access token is missing" });
  }

  try {
    const decoded = jwt.verify(token, config.accessTokenSecret);
    const user = await userFactory.getById(decoded.userId);

    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    request.user = user;
  } catch (error) {
    return reply.code(403).send({ message: "Invalid access token" });
  }
};

/**
 * Returns a Fastify onRequest hook that checks if the authenticated user
 * has the required permissions.
 * @function authorize
 * @param {Array} requiredPermissions - The permissions required to access the route.
 * @returns {Function} - Fastify hook function.
 */
const authorize = (requiredPermissions) => {
  return async (request, reply) => {
    const user = request.user;

    if (!user) {
      return reply.code(401).send({ message: "User not authenticated" });
    }

    const hasPermission = await authService.checkUserPermissions(
      user,
      requiredPermissions
    );

    if (!hasPermission) {
      return reply.code(403).send({ message: "Access denied" });
    }
  };
};

/**
 * Returns a Fastify onRequest hook that checks if the user is an admin.
 * @function isAdmin
 * @returns {Function} - Fastify hook function.
 */
const isAdmin = () => {
  return async (request, reply) => {
    const user = request.user;

    if (!user) {
      return reply.code(401).send({ message: "User not authenticated" });
    }

    if (user.role !== "admin") {
      return reply.code(403).send({ message: "Access denied" });
    }
  };
};

module.exports = {
  authenticate,
  authorize,
  isAdmin,
};
