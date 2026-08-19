"use strict";

const helpers = require("../../../helpers");
const { Role } = require("../models");

// Fetch roles based on filters with pagination and sorting
const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    // Default sort if none provided
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];
    // Pagination parameters
    let { limit, offset } = helpers.getPagination(page, size);

    const roles = await Role.findAll({
      limit: limit,
      offset: offset,
      where: filters, // Apply filters
      order: [sort], // Sorting
      include: include, // Include related models if needed
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (roles && roles.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: roles,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Get the count of roles based on filters
const getCountByFilter = async (filters) => {
  try {
    const rolesCount = await Role.count({
      where: filters,
    });

    return rolesCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a role by its ID
const getById = async (roleId) => {
  try {
    const role = await Role.findOne({
      where: {
        role_id: roleId,
      },
    });

    return role;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add a new role
const add = async (roleData) => {
  try {
    const role = await Role.create(roleData);

    return role;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Update an existing role by its ID
const update = async (roleId, roleData) => {
  try {
    const role = await getById(roleId);
    if (!role) throw new Error("Role not found");

    await role.update(roleData);

    return role;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Remove a role by its ID
const remove = async (roleId) => {
  try {
    const role = await Role.destroy({
      where: {
        role_id: roleId,
      },
    });

    return role;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Export all functions
module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  add,
  update,
  remove,
};

