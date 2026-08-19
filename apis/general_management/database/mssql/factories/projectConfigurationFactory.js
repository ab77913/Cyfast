"use strict";

const helpers = require("../../../helpers");
const { ProjectConfiguration } = require("../models");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const projectConfigurations = await ProjectConfiguration.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (projectConfigurations && projectConfigurations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: projectConfigurations,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);

    return {
      data: [],
      pagination: {},
    };
  }
};

const getCountByFilter = async (filters) => {
  try {
    const projectConfigurationsCount = await ProjectConfiguration.count({
      where: filters,
    });

    return projectConfigurationsCount;
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getById = async (projectConfigurationId) => {
  try {
    const projectConfiguration = await ProjectConfiguration.findOne({
      where: {
        ProjectConfigurationId: projectConfigurationId,
      },
    });

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByProjectId = async (projectId) => {
  try {
    const projectConfiguration = await ProjectConfiguration.findOne({
      where: {
        ProjectId: projectId,
      },
    });

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (projectConfigurationData) => {
  try {
    const projectConfiguration = await ProjectConfiguration.create(projectConfigurationData);

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const update = async (projectConfigurationId, projectConfigurationData) => {
  try {
    const projectConfiguration = await getById(projectConfigurationId);
    if (!projectConfiguration) throw new Error("Project not found");

    await projectConfiguration.update(projectConfigurationData);

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const updateByProjectId = async (projectId, projectConfigurationData) => {
  try {
    const projectConfiguration = await getByProjectId(projectId);
    if (!projectConfiguration) throw new Error("Project not found");

    await projectConfiguration.update(projectConfigurationData);

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const remove = async (projectConfigurationId) => {
  try {
    const projectConfiguration = await getById(projectConfigurationId);
    if (!projectConfiguration) throw new Error("Project configuration not found");

    await projectConfiguration.destroy();

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const projectConfiguration = await getById(projectId);
    if (!projectConfiguration) throw new Error("Project configuration not found");

    await projectConfiguration.destroy();

    return projectConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getById: getById,
  getByProjectId: getByProjectId,
  add: add,
  update: update,
  updateByProjectId: updateByProjectId,
  remove: remove,
  removeByProjectId: removeByProjectId,
};
