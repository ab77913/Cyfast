/**
 * Authentication middleware for Express.js applications.
 * It checks if the request contains a valid JWT token in the Authorization header.
 * @module middlewares/auth
 * @requires express
 * @requires jsonwebtoken
 * @requires config
 * @requires userFactory
 * @requires authService
 */

"use strict";
const express = require("express");
const jwt = require("jsonwebtoken");
const config = require("../config.js");
const userFactory = require("../database/" +
  config.db_type_primary +
  "/factories/user-factory");
const authService = require("../services/auth-service");
const router = express.Router();

/**
 * Middleware to authenticate requests using JWT.
 * It checks for the presence of a token in the Authorization header,
 * verifies it, and attaches the user information to the request object.
 * If the token is invalid or missing, it responds with an error.
 * @function authenticate
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token is missing" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt_secret);
    const user = await userFactory.getById(decoded.user_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid access token" });
  }
};

/**
 * Middleware to check if the user has the required permissions.
 * It checks the user's role and permissions against the required permissions.
 * If the user does not have the required permissions, it responds with an error.
 * @function authorize
 * @param {Array} requiredPermissions - The permissions required to access the route.
 * @returns {Function} - The middleware function.
 */

const authorize = (requiredPermissions) => {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const hasPermission = await authService.checkUserPermissions(
      user,
      requiredPermissions
    );

    if (!hasPermission) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};

/**
 * Middleware to check if the user is an admin.
 * It checks the user's role and responds with an error if the user is not an admin.
 * @function isAdmin
 * @returns {Function} - The middleware function.
 */
const isAdmin = () => {
  return async (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};
