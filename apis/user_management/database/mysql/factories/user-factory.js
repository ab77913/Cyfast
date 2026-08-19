/**
 * User Factory for MySQL Database
 * @module UserFactory
 * @description This module provides functions to interact with the User model in a MySQL database.
 * It includes methods for fetching users by various filters, adding, updating, and removing users.
 * @requires helpers - Utility functions for pagination and other operations.
 * @requires User - The User model from the models directory.
 */

"use strict";

const helpers = require("../../../helpers");
const { User, UserRole, Role } = require("../models");
const bcrypt = require("bcryptjs");

// Ensure roles are always fetched cleanly
const includeRoles = {
  model: Role,
  as: "roles",
  attributes: ["role_id", "name"],
  through: { attributes: [] },
};

// Fetch users based on filters with pagination and sorting
const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    // Default sorting if none provided
    const order = sort && sort.length ? [sort] : [["created_date", "DESC"]];

    // Robust pagination (no dependency on getPagingData)
    let limit, offset;
    if (helpers && typeof helpers.getPagination === "function") {
      ({ limit, offset } = helpers.getPagination(page, size));
    } else if (size) {
      limit = Number(size);
      const currentPage = page ? Number(page) : 1;
      offset = (currentPage - 1) * limit;
    }

    const users = await User.findAndCountAll({
      where: filters || {},
      order,
      ...(limit ? { limit } : {}),
      ...(offset || offset === 0 ? { offset } : {}),
      include: [includeRoles],
    });

    const totalItems = users.count ?? 0;
    const currentPage = page ? Number(page) : 1;
    const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

    return {
      data: users.rows || [],
      pagination: size
        ? { totalItems, totalPages, currentPage, pageSize: limit }
        : undefined,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Get the count of users based on filters
const getCountByFilter = async (filters) => {
  try {
    const usersCount = await User.count({
      where: filters,
    });

    return usersCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a user by their ID
const getById = async (userId) => {
  try {
    const user = await User.findOne({
      where: { user_id: userId },
      include: [includeRoles],
    });

    if (!user) throw new Error("User not found");

    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a user by their email
const getByEmail = async (email) => {
  try {
    const user = await User.findOne({
      where: { email: email },
      include: [includeRoles],
    });

    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a user by their username
const getByUsername = async (username) => {
  try {
    const user = await User.findOne({
      where: { username: username },
      include: [includeRoles],
    });

    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a user by their username
const getByAccessToken = async (accessToken, include = []) => {
  try {
    const user = await User.findOne({
      where: {
        access_token: accessToken,
      },
      include: [includeRoles, ...include],
    });

    return user;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add a new user
const add = async (userData) => {
  try {
    const roleIds = userData.role_ids || userData.roleIds || [];

    if (userData.password) {
      userData.password_hash = await bcrypt.hash(userData.password, 10);
      delete userData.password;
    }

    // Create user
    const user = await User.create(userData);

    // Make sure user_role rows get organization_id
    const orgId = user.organization_id ?? userData.organization_id;
    if (Array.isArray(roleIds) && roleIds.length) {
      await addUserRoles(user.user_id, roleIds, orgId);
    }

    return await getById(user.user_id);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Update an existing user by their ID
const update = async (userId, userData) => {
  try {
    const existingUser = await User.findByPk(userId);
    if (!existingUser) throw new Error("User not found");

    if (userData.password) {
      userData.password_hash = await bcrypt.hash(userData.password, 10);
      delete userData.password;
    }

    await existingUser.update(userData);

    const hasRoleIdsArray =
      Array.isArray(userData.role_ids) || Array.isArray(userData.roleIds);

    if (hasRoleIdsArray) {
      const roleIds = userData.role_ids || userData.roleIds || [];

      const orgId = existingUser.organization_id ?? userData.organization_id;
      await updateUserRoles(userId, roleIds, orgId);
    }

    return await getById(userId);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Remove a user by their ID
const remove = async (userId) => {
  try {
    await UserRole.destroy({
      where: { user_id: userId },
    });

    const user = await User.destroy({
      where: { user_id: userId },
    });

    return user; // number of rows deleted
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add UserRole association
const addUserRoles = async (userId, roleIds, orgId) => {
  try {
    // Ensure roleIds is an array
    if (!Array.isArray(roleIds)) throw new Error("roleIds must be an array");
    if (orgId === undefined || orgId === null) {
      throw new Error("organization_id is required for user_role");
    }

    if (!roleIds.length) return true;

    // Create associations between user and roles
    const rows = roleIds.map((roleId) => ({
      user_id: userId,
      role_id: roleId,
      organization_id: orgId,
    }));

    await UserRole.bulkCreate(rows);
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Remove UserRole association
const removeUserRoles = async (userId, roleIds = []) => {
  try {
    const where = { user_id: userId };
    // Ensure roleIds is an array
    if (Array.isArray(roleIds) && roleIds.length) where.role_id = roleIds;
    await UserRole.destroy({
      where: {
        user_id: userId,
        role_id: roleIds,
      },
    });

    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Update UserRole association
const updateUserRoles = async (userId, roleIds, orgId) => {
  try {
    // Ensure roleIds is an array
    if (!Array.isArray(roleIds)) throw new Error("roleIds must be an array");
    if (orgId === undefined || orgId === null) {
      throw new Error("organization_id is required for user_role");
    }

    await UserRole.destroy({ where: { user_id: userId } });
    if (roleIds.length) {
      await addUserRoles(userId, roleIds, orgId);
    }
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Export all functions
module.exports = {
  getByFilter,
  getById,
  getByEmail,
  getByUsername,
  getByAccessToken,
  add,
  update,
  remove,
  addUserRoles,
  removeUserRoles,
  updateUserRoles,
};
