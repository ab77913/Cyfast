"use strict";

const helpers = require("../../../helpers");
const { Organization } = require("../models");

// Fetch organizations based on filters, with pagination and sorting
const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"]; // Default sort if none provided
    let { limit, offset } = helpers.getPagination(page, size); // Calculate pagination values

    const organizations = await Organization.findAll({
      limit: limit,
      offset: offset,
      where: filters, // Apply filters
      order: [sort], // Apply sorting
      include: include, // Include any related models if necessary
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

// Count organizations based on filters
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

// Fetch an organization by ID
const getById = async (organizationId) => {
  try {
    const organization = await Organization.findOne({
      where: {
        organization_id: organizationId,
      },
    });

    return organization;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Fetch an organization by name
const getByOrganizationName = async (organizationName) => {
  try {
    const organization = await Organization.findOne({
      where: {
        name: organizationName,
      },
    });

    return organization;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add a new organization
const add = async (organizationData) => {
  try {
    const organization = await Organization.create(organizationData);

    return organization;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addOrFetch = async (organizationData) => {
  try {
    let organization = await getByOrganizationName(organizationData.name);
    if (!organization) {
      organization = await Organization.create(organizationData);
    }

    return organization;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Add or update an organization based on existence
const addOrUpdate = async (organizationData) => {
  try {
    let organization = await getByOrganizationName(organizationData.name);
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

// Update an organization by ID
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

// Remove an organization by ID
const remove = async (organizationId) => {
  try {
    const organization = await Organization.destroy({
      where: {
        organization_id: organizationId,
      },
    });

    return organization;
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
  getByOrganizationName,
  add,
  addOrFetch,
  addOrUpdate,
  update,
  remove,
};
