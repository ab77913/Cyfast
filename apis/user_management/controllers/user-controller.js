"use strict";

const bcrypt = require("bcryptjs/dist/bcrypt.js");
const config = require("../config.js");
const userFactory = require("../database/" +
  config.db_type_primary +
  "/factories/user-factory");
const userService = require("../services/user-service.js");
const { Role } = require("../database/" + config.db_type_primary + "/models");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getUsers = async (request, reply) => {
  try {
    const { page, size, filters, sort } = request.query;
    const include = [
      {
        model: Role,
        as: "roles",
        attributes: ["role_id", "name"],
        through: { attributes: [] },
      },
    ];
    const users = await userFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );
    return reply.code(200).send(users);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const getUser = async (request, reply) => {
  try {
    const userId = request.params.userId || request.params.id;
    const include = [
      {
        model: Role,
        as: "roles",
        attributes: ["role_id", "name"],
        through: { attributes: [] },
      },
    ];
    const user = await userFactory.getById(userId, include);
    if (!user) return reply.code(404).send({ message: "User not found" });
    return reply.code(200).send(user);
  } catch (error) {
    console.error("getUser error:", error);
    return reply.code(500).send(error);
  }
};

const getMyProfile = async (request, reply) => {
  try {
    const accessToken = request.headers.authorization.split(" ")[1];
    const user = await userFactory.getByAccessToken(accessToken);
    if (!user) return reply.code(404).send({ message: "User not found" });

    return reply.code(200).send(user);
  } catch (error) {
    console.error("getUser error:", error);
    return reply.code(500).send(error);
  }
};

const addUser = async (request, reply) => {
  try {
    const userData = { ...request.body };

    if (!userData.email || !userData.password) {
      return reply
        .code(400)
        .send({ message: "Email and password are required" });
    }

    if (!emailRegex.test(userData.email)) {
      return reply.code(400).send({ message: "Invalid email format" });
    }

    if (userData.password.length < 6) {
      return reply
        .code(400)
        .send({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await userFactory.getByEmail(userData.email);
    if (existingUser) {
      return reply.code(400).send({ message: "User already exists" });
    }

    const roleIds = userData.roleIds || userData.role_ids || [];
    userData.role_ids = roleIds;
    delete userData.roleIds;

    userData.username = userData.username || userData.email;
    userData.password_hash = bcrypt.hashSync(userData.password, 10);
    delete userData.password;

    const user = await userFactory.add(userData);

    const include = [
      {
        model: Role,
        as: "roles",
        attributes: ["role_id", "name"],
        through: { attributes: [] },
      },
    ];
    const userWithRoles = await userFactory.getById(user.user_id, include);
    return reply.code(200).send(userWithRoles);
  } catch (error) {
    console.error("addUser error:", error);
    return reply.code(500).send(error);
  }
};

const updateUser = async (request, reply) => {
  try {
    const rawId = request.params.userId || request.params.id || request.body.user_id;
    const userId = Number(rawId);

    if (!Number.isFinite(userId))
      return reply.code(400).send({ message: "Invalid user id" });

    const userData = { ...request.body };

    if (!userData.email) {
      return reply.code(400).send({ message: "Email is required" });
    }

    if (!emailRegex.test(userData.email)) {
      return reply.code(400).send({ message: "Invalid email format" });
    }

    if (userData.password && userData.password.length < 6) {
      return reply
        .code(400)
        .send({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await userFactory.getById(userId);
    if (!existingUser) {
      return reply.code(404).send({ message: "User not found" });
    }

    const roleIds = userData.roleIds || userData.role_ids;
    if (Array.isArray(roleIds)) userData.role_ids = roleIds;
    delete userData.roleIds;

    if (userData.password) {
      userData.password_hash = bcrypt.hashSync(userData.password, 10);
      delete userData.password;
    }
    userData.username = userData.username || userData.email;

    const user = await userFactory.update(userId, userData);

    return reply.code(200).send(user);
  } catch (error) {
    console.error("updateUser error:", error);
    return reply.code(500).send(error);
  }
};

const deleteUser = async (request, reply) => {
  try {
    const userId = request.params.userId || request.params.id;

    const user = await userFactory.remove(userId);

    return reply.code(200).send(user);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const changePassword = async (request, reply) => {
  try {
    const userId = request.params.userId;
    const userData = request.body;

    const user = await userService.changePassword(userId, userData);

    return reply.code(200).send(user);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

const resetPassword = async (request, reply) => {
  try {
    const userId = request.params.userId;
    const userData = request.body;

    const user = await userService.resetPassword(userId, userData);

    return reply.code(200).send(user);
  } catch (error) {
    return reply.code(500).send(error);
  }
};

module.exports = {
  getUsers,
  getUser,
  getMyProfile,
  addUser,
  updateUser,
  deleteUser,
  changePassword,
  resetPassword,
};
