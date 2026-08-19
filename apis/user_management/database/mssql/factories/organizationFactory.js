"use strict";

const helpers = require("../../../helpers");
const { Organization } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const organizations = await Organization.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (organizations && organizations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: organizations,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const organizationsCount = await Organization.count({
      where: filters,
    });

    return organizationsCount;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getById = async (organizationId) => {
  try {
    const organization = await Organization.findOne({
      where: {
        OrganizationId: organizationId,
      },
    });

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getByOrganizationName = async (organizationName) => {
  try {
    const organization = await Organization.findOne({
      where: {
        Name: organizationName,
      },
    });

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const add = async (organizationData) => {
  try {
    const organization = await Organization.create(organizationData);

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const addOrUpdate = async (organizationData) => {
  try {
    const organization = await getByOrganizationName(organizationData.OrganizationName);
    if (!organization) {
      organization = await Organization.create(organizationData);
    } else {
      await organization.update(organizationData);
    }

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const update = async (organizationId, organizationData) => {
  try {
    const organization = await getById(organizationId);
    if (!organization) throw new Error("Organization not found");

    await organization.update(organizationData);

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const remove = async (organizationId) => {
  try {
    const organization = await Organization.destroy({
      where: {
        OrganizationId: organizationId,
      },
    });

    return organization;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByOrganizationName,
  add,
  addOrUpdate,
  update,
  remove,
};
