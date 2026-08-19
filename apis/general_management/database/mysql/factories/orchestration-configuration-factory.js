// Sorting Format: Updated to use [['created_date', 'DESC']].
// Pagination Handling: Ensured that helpers.getPagination is used correctly.
// Default Values: Provided defaults for page and size.
// Error Handling: Improved error handling and logging.
// Update Method: Added error handling for record not found during update.

"use strict";

const helpers = require("../../../helpers");
const { OrchestrationConfiguration } = require("../models");
const { Op } = require("sequelize");

const getByFilter = async (filters = {}, sort = [], page = 1, size = 10) => {
  try {
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrationConfigurations =
      await OrchestrationConfiguration.findAll({
        limit: limit,
        offset: offset,
        where: filters,
        order: sort,
      });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (orchestrationConfigurations.length > 0) {
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

const getCountByFilter = async (filters = {}) => {
  try {
    return await OrchestrationConfiguration.count({
      where: filters,
    });
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getById = async (orchestrationConfigurationId) => {
  try {
    return await OrchestrationConfiguration.findOne({
      where: {
        orchestration_configuration_id: orchestrationConfigurationId,
      },
    });
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByOrchestrationId = async (orchestrationId) => {
  try {
    return await OrchestrationConfiguration.findOne({
      where: {
        orchestration_id: orchestrationId,
      },
    });
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (orchestrationConfigurationData) => {
  try {
    return await OrchestrationConfiguration.create(
      orchestrationConfigurationData
    );
  } catch (error) {
    console.log(error);

    return null;
  }
};

const update = async (
  orchestrationConfigurationId,
  orchestrationConfigurationData
) => {
  try {
    const orchestrationConfiguration = await getById(
      orchestrationConfigurationId
    );
    if (!orchestrationConfiguration)
      throw new Error("OrchestrationConfiguration not found");

    await orchestrationConfiguration.update(orchestrationConfigurationData);

    return orchestrationConfiguration;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const remove = async (orchestrationConfigurationId) => {
  try {
    const rowsDeleted = await OrchestrationConfiguration.destroy({
      where: {
        orchestration_configuration_id: orchestrationConfigurationId,
      },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const rowsDeleted = await OrchestrationConfiguration.destroy({
      where: {
        orchestration_id: orchestrationId,
      },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await OrchestrationConfiguration.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByOrchestrationId,
  add,
  update,
  remove,
  removeByOrchestrationId,
  removeByProjectId,
};
