// Sorting Format: Updated to use [['created_date', 'DESC']].
// Default Values: Ensured default values for page and size are used.
// Filters Handling: Improved handling and validation of filters.
// Update Method: Modified to find the record before updating.

"use strict";

const { Op } = require("sequelize");
const helpers = require("../../../helpers");
const { OrchestrationExecution } = require("../models");
const orchestrationData = require("../data/orchestrations");

const getByFilter = async (
  filters = {},
  sort = [],
  page = 1,
  size = 10,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    if (filters.created_date) {
      filters.created_date = {
        [Op.gte]: filters.created_date,
      };
    }
    if (filters.orchestration_ids) {
      filters.orchestration_id = {
        [Op.in]: filters.orchestration_ids.split(","),
      };
      delete filters.orchestration_ids;
    }

    const orchestrationExecutions = await OrchestrationExecution.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
      include: include ? include.split(",") : undefined,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (orchestrationExecutions.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrationExecutions,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters = {}) => {
  try {
    return await OrchestrationExecution.count({ where: filters });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getById = async (orchestrationExecutionId) => {
  try {
    return await OrchestrationExecution.findOne({
      where: { orchestration_execution_id: orchestrationExecutionId },
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getExecutionDuration = async (projectId) => {
  try {
    return orchestrationData.getExecutionDuration(projectId);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCurrentExecution = async (orchestrationId) => {
  try {
    return await OrchestrationExecution.findOne({
      where: {
        orchestration_id: orchestrationId,
        status: "INPROGRESS",
      },
      sort: [["created_date", "DESC"]],
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getPausedExecution = async (orchestrationId) => {
  try {
    return await OrchestrationExecution.findOne({
      where: {
        orchestration_id: orchestrationId,
        status: "PAUSED",
      },
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getLatestExecutions = async (projectId) => {
  try {
    return orchestrationData.getLatestExecutionsByProjectId(projectId);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const add = async (orchestrationExecutionData) => {
  try {
    return await OrchestrationExecution.create(orchestrationExecutionData);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const update = async (orchestrationExecutionId, orchestrationExecutionData) => {
  try {
    const orchestrationExecution = await getById(orchestrationExecutionId);
    if (!orchestrationExecution)
      throw new Error("Orchestration Execution not found");

    return await orchestrationExecution.update(orchestrationExecutionData);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const remove = async (orchestrationExecutionId) => {
  try {
    const rowsDeleted = await OrchestrationExecution.destroy({
      where: { orchestration_execution_id: orchestrationExecutionId },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const rowsDeleted = await OrchestrationExecution.destroy({
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
    const rowsDeleted = await OrchestrationExecution.destroy({
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
  getExecutionDuration,
  getLatestExecutions,
  getCurrentExecution,
  getPausedExecution,
  add,
  update,
  remove,
  removeByOrchestrationId,
  removeByProjectId,
};
