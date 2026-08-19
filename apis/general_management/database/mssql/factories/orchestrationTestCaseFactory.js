"use strict";

const helpers = require("../../../helpers");
const { OrchestrationTestCase } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrationTestCases = await OrchestrationTestCase.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
    });

    let pagination = {};
    const totalItems = await getCountByFilter({});
    if (orchestrationTestCases && orchestrationTestCases.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrationTestCases,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const orchestrationTestCasesCount = await OrchestrationTestCase.count({
      where: filters,
    });

    return orchestrationTestCasesCount;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getById = async (orchestrationTestCaseId) => {
  try {
    const orchestrationTestCase = await OrchestrationTestCase.findOne({
      where: {
        OrchestrationTestCaseId: orchestrationTestCaseId,
      },
    });

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const getByOrchestrationId = async (orchestrationId) => {
  try {
    const orchestrationTestCases = await OrchestrationTestCase.findAll({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return orchestrationTestCases;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const add = async (orchestrationTestCaseData) => {
  try {
    const orchestrationTestCase = await OrchestrationTestCase.create(orchestrationTestCaseData);

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const update = async (orchestrationTestCaseId, orchestrationTestCaseData) => {
  try {
    const orchestrationTestCase = await getById(orchestrationTestCaseId);
    if (!orchestrationTestCase) throw new Error("OrchestrationTestCase not found");

    await orchestrationTestCase.update(orchestrationTestCaseData);

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const addOrUpdate = async (orchestrationTestCaseData) => {
  try {
    let orchestrationTestCases = await getByFilter({
      OrchestrationId: orchestrationTestCaseData.OrchestrationId,
      TestCaseId: orchestrationTestCaseData.TestCaseId,
      TestEnvironmentId: orchestrationTestCaseData.TestEnvironmentId,
    });

    if (orchestrationTestCases.data.length > 0) {
      return await update(orchestrationTestCases.data[0].OrchestrationTestCaseId, orchestrationTestCaseData);
    } else {
      return await add(orchestrationTestCaseData);
    }
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const remove = async (orchestrationTestCaseId) => {
  try {
    const orchestrationTestCase = await OrchestrationTestCase.destroy({
      where: {
        OrchestrationTestCaseId: orchestrationTestCaseId,
      },
    });

    return orchestrationTestCase;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedOrchTestCases = await OrchestrationTestCase.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedOrchTestCases;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const deletedOrchTestCases = await OrchestrationTestCase.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return deletedOrchTestCases;
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
  addOrUpdate: addOrUpdate,
  remove: remove,
  removeByProjectId: removeByProjectId,
  removeByOrchestrationId: removeByOrchestrationId,
};
