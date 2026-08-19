"use strict";

const helpers = require("../../../helpers");
const { OrchestrationConfiguration } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrationConfigurations = await OrchestrationConfiguration.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
    });

    let pagination = {};
    const totalItems = await getCountByFilter({});
    if (orchestrationConfigurations && orchestrationConfigurations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrationConfigurations,
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
    const orchestrationConfigurationsCount = await OrchestrationConfiguration.count({
      where: filters,
    });

    return orchestrationConfigurationsCount;
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getById = async (orchestrationConfigurationId) => {
  try {
    const orchestrationConfiguration = await OrchestrationConfiguration.findOne({
      where: {
        OrchestrationConfigurationId: orchestrationConfigurationId,
      },
    });

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByOrchestrationId = async (orchestrationId) => {
  try {
    const orchestrationConfiguration = await OrchestrationConfiguration.findOne({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (orchestrationConfigurationData) => {
  try {
    const orchestrationConfiguration = await OrchestrationConfiguration.create(orchestrationConfigurationData);

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const update = async (orchestrationConfigurationId, orchestrationConfigurationData) => {
  try {
    const orchestrationConfiguration = await getById(orchestrationConfigurationId);
    if (!orchestrationConfiguration) throw new Error("OrchestrationConfiguration not found");

    await orchestrationConfiguration.update(orchestrationConfigurationData);

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const remove = async (orchestrationConfigurationId) => {
  try {
    const orchestrationConfiguration = await OrchestrationConfiguration.destroy({
      where: {
        OrchestrationConfigurationId: orchestrationConfigurationId,
      },
    });

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedOrchConfigs = await OrchestrationConfiguration.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedOrchConfigs;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const deletedOrchConfigs = await OrchestrationConfiguration.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return deletedOrchConfigs;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter: getByFilter,
  getCountByFilter: getCountByFilter,
  getById: getById,
  getByOrchestrationId: getByOrchestrationId,
  add: add,
  update: update,
  remove: remove,
  removeByProjectId: removeByProjectId,
  removeByOrchestrationId: removeByOrchestrationId,
};
