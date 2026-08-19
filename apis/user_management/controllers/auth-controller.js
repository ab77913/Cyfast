/**
 * @module controllers/auth-controller
 * @description Handles user authentication, including login, logout, password reset, and forgot password functionalities.
 * @requires bcryptjs
 * @requires config
 * @requires userFactory
 * @requires authService
 */

"use strict";

const bcrypt = require("bcryptjs");
const config = require("../config.js");
const userFactory = require("../database/" +
  config.db_type_primary +
  "/factories/user-factory");
const authService = require("../services/auth-service");

/**
 * Logs in a user by validating credentials and generating access and refresh tokens.
 * @function login
 * @param {Object} request - The Fastify request object containing user credentials.
 * @param {Object} reply - The Fastify reply object to send the result.
 * @returns {Object} JSON response with access token, refresh token, and user details or an error message.
 */
const login = async (request, reply) => {
  try {
    const userData = request.body;

    if ((!userData.username && !userData.email) || !userData.password) {
      return reply
        .code(400)
        .send({ message: "Username and password are required!" });
    }

    let user;
    if (userData.email) {
      user = await userFactory.getByEmail(userData.email);
    } else {
      user = await userFactory.getByUsername(userData.username);
    }
    if (user) {
      let isPasswordValid = bcrypt.compareSync(
        userData.password,
        user.password_hash
      );
      if (!isPasswordValid) {
        return reply.code(400).send({ message: "Invalid Password!" });
      }
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      user.access_token = accessToken;
      user.refresh_token = refreshToken;
      user.save();

      return reply.code(200).send({
        accessToken: accessToken,
        refreshToken: refreshToken,
        serviceToken: accessToken,
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      });
    }
    return reply.code(400).send({ message: "Verify email address." });
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const logout = async (request, reply) => {
  try {
    const accessToken = request.headers.authorization.split(" ")[1];
    const decoded = authService.decodeToken(accessToken);
    const username = decoded.username;

    const user = await userFactory.getByUsername(username);
    if (user) {
      user.AccessToken = null;
      user.RefreshToken = null;
      userFactory.update(user.user_id, user);
    }

    return reply.code(200).send({ message: "Logout successful" });
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const forgotPassword = async (request, reply) => {
  try {
    const { email } = request.body;

    const user = await userFactory.getByEmail(email);
    if (!user) {
      return reply.code(404).send("User not found");
    }

    const resetToken = authService.generateResetToken(user);

    return reply.code(200).send({ resetToken });
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const resetPassword = async (request, reply) => {
  try {
    const { resetToken, newPassword } = request.body;

    const decoded = authService.verifyResetToken(resetToken);
    if (!decoded) {
      return reply
        .code(400)
        .send({ message: "Invalid or expired reset token" });
    }

    const user = await userFactory.getById(decoded.userId);
    if (!user) {
      return reply.code(404).send({ message: "User not found" });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 8);

    user.password_hash = hashedPassword;
    await userFactory.update(user.userId, user);

    return reply.code(200).send({ message: "Password reset successful" });
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const getCurrentUser = async (request, reply) => {
  try {
    const accessToken = request.headers.authorization.split(" ")[1];
    const user = await userFactory.getByAccessToken(accessToken);
    user.serviceToken = accessToken;
    delete user.password_hash;
    delete user.access_token;
    delete user.refresh_token;

    return reply.code(200).send(user);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

module.exports = {
  login,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser,
};
