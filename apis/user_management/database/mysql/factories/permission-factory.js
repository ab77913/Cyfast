"use strict";

const helpers = require("../../../helpers");
const { Permission } = require("../models");

// Fetch permissions based on filters with pagination and sorting
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

    const permissions = await Permission.findAll({
      limit: limit,
      offset: offset,
      where: filters, // Apply filters
      order: [sort], // Sorting
      include: include, // Include related models if needed
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (permissions && permissions.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: permissions,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Get the count of permissions based on filters
const getCountByFilter = async (filters) => {
  try {
    const permissionsCount = await Permission.count({
      where: filters,
    });

    return permissionsCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch a permission by its ID
const getById = async (permissionId) => {
  try {
    const permission = await Permission.findOne({
      where: {
        permission_id: permissionId,
      },
    });

    return permission;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add a new permission
const add = async (permissionData) => {
  try {
    const permission = await Permission.create(permissionData);

    return permission;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Update an existing permission by its ID
const update = async (permissionId, permissionData) => {
  try {
    const permission = await getById(permissionId);
    if (!permission) throw new Error("Permission not found");

    await permission.update(permissionData);

    return permission;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Remove a permission by its ID
const remove = async (permissionId) => {
  try {
    const permission = await Permission.destroy({
      where: {
        permission_id: permissionId,
      },
    });

    return permission;
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

