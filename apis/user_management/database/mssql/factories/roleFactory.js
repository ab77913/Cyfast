"use strict";

const helpers = require("../../../helpers");
const { Role } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const roles = await Role.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
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

const getById = async (roleId) => {
  try {
    const role = await Role.findOne({
      where: {
        RoleId: roleId,
      },
    });

    return role;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const add = async (roleData) => {
  try {
    const role = await Role.create(roleData);

    return role;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

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

const remove = async (roleId) => {
  try {
    const role = await Role.destroy({
      where: {
        RoleId: roleId,
      },
    });

    return role;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  add,
  update,
  remove,
};
