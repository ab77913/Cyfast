"use strict";

const helpers = require("../../../helpers");
const { User } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const users = await User.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (users && users.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: users,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);

    throw error;
  }
};

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

const getById = async (userId) => {
  try {
    const user = await User.findOne({
      where: {
        UserId: userId,
      },
    });

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getByEmail = async (email) => {
  try {
    const user = await User.findOne({
      where: {
        Email: email,
      },
    });

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getByUsername = async (username) => {
  try {
    const user = await User.findOne({
      where: {
        Username: username,
      },
    });

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const add = async (userData) => {
  try {
    const user = await User.create(userData);

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const update = async (userId, userData) => {
  try {
    const user = await getById(userId);
    if (!user) throw new Error("User not found");

    await user.update(userData);

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const remove = async (userId) => {
  try {
    const user = await User.destroy({
      where: {
        UserId: userId,
      },
    });

    return user;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByEmail,
  getByUsername,
  add,
  update,
  remove,
};
