"use strict";

const sequelize = require("sequelize");
const { Op } = require("sequelize");

const helpers = require("../../../helpers");
const { OrchestrationExecution } = require("../models");
const orchestrationData = require("../data/orchestrations");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    if (filters != undefined && filters.CreatedDate) {
      filters.CreatedDate = {
        [Op.gte]: filters.CreatedDate,
      };
    }
    if (filters != undefined && filters.OrchestrationIds) {
      filters.OrchestrationId = {
        [Op.in]: filters.OrchestrationIds.split(","),
      };
      delete filters.OrchestrationIds;
    }

    const orchestrationExecutions = await OrchestrationExecution.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter({});
    if (orchestrationExecutions && orchestrationExecutions.length > 0) {
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

const getCountByFilter = async (filters) => {
  try {
    const count = await OrchestrationExecution.count({
      where: filters,
    });

    return count;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getById = async (orchestrationExecutionId) => {
  try {
    const orchestrationExecution = await OrchestrationExecution.findOne({
      where: { OrchestrationExecutionId: orchestrationExecutionId },
    });

    return orchestrationExecution;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getExecutionDuration = async (projectId) => {
  try {
    const executionDuration = orchestrationData.getExecutionDuration(projectId);

    return executionDuration;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getLatestExecutions = async (projectId) => {
  try {
    const LatestExecutions = orchestrationData.getLatestExecutionsByProjectId(projectId);

    return LatestExecutions;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const add = async (orchestrationExecutionData) => {
  try {
    const orchestrationExecution = await OrchestrationExecution.create(orchestrationExecutionData);

    return orchestrationExecution;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const update = async (orchestrationExecutionId, orchestrationExecutionData) => {
  try {
    const orchestrationExecution = await OrchestrationExecution.update(orchestrationExecutionData, {
      where: {
        OrchestrationExecutionId: orchestrationExecutionId,
      },
    });

    return orchestrationExecution;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const updateByFilter = async (filters, orchestrationExecutionData) => {
  try {
    await TestCaseExecution.update(orchestrationExecutionData, {
      where: filters,
    });

    return true;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const remove = async (orchestrationExecutionId) => {
  try {
    const orchestrationExecution = await OrchestrationExecution.destroy({
      where: {
        OrchestrationExecutionId: orchestrationExecutionId,
      },
    });

    return orchestrationExecution;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedOrchExecutions = await OrchestrationExecution.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedOrchExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const deletedOrchExecutions = await OrchestrationExecution.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return deletedOrchExecutions;
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
  add,
  update,
  updateByFilter,
  remove,
  removeByProjectId,
  removeByOrchestrationId,
};
