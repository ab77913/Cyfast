"use strict";

const sequelize = require("sequelize");
const { Op } = require("sequelize");

const helpers = require("../../../helpers");
const { Orchestration, OrchestrationTestCase } = require("../models");
const orchestrationTestCaseFactory = require("./orchestrationTestCaseFactory");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const orchestrations = await Orchestration.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include ? include.split(",") : include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter({});
    if (orchestrations && orchestrations.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: orchestrations,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const orchestrationsCount = await Orchestration.count({
      where: filters,
    });

    return orchestrationsCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getById = async (orchestrationId) => {
  try {
    const orchestration = await Orchestration.findOne({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return orchestration;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByProjectId = async (projectId, sort = []) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];

    const orchestrations = await Orchestration.findAll({
      where: {
        ProjectId: projectId,
      },
      order: [sort],
    });

    return orchestrations;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const add = async (orchestrationData) => {
  try {
    const orchestration = await Orchestration.create(orchestrationData);

    return orchestration;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const update = async (orchestrationId, orchestrationData) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    await orchestration.update(orchestrationData);

    return orchestration;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const remove = async (orchestrationId) => {
  try {
    const orchestration = await Orchestration.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return orchestration;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedOrchs = await Orchestration.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedOrchs;
  } catch (error) {
    console.log(error);

    return null;
  }
};

//Test Cases

const getTestCases = async (orchestrationId, filters = {}) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    const testCases = await OrchestrationTestCase.findAll({
      where: {
        OrchestrationId: orchestrationId,
        ...filters,
      },
    });

    return testCases;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const updateTestCases = async (orchestrationId, testCasesData) => {
  try {
    const orchestration = await getById(orchestrationId);
    if (!orchestration) throw new Error("Orchestration not found");

    let deletedCount = 0;
    let addedCount = 0;
    let previousCount = 0;

    if (testCasesData.length > 0) {
      let existingTestCases = await getTestCases(orchestrationId, {});
      previousCount = existingTestCases.length;

      let keyedNewTestCases = helpers.rekey(testCasesData, "TestCaseId");
      console.log(keyedNewTestCases);
      for (let i = 0; i < existingTestCases.length; i++) {
        let existingTestCase = existingTestCases[i];
        if (keyedNewTestCases[existingTestCase.TestCaseId]) {
          let newTestCaseEnvIds = keyedNewTestCases[existingTestCase.TestCaseId].map((item) => item.TestEnvironmentId);
          if (!newTestCaseEnvIds.includes(existingTestCase.TestEnvironmentId)) {
            await orchestrationTestCaseFactory.remove(existingTestCase.OrchestrationTestCaseId);
            deletedCount++;
          }
        } else {
          await orchestrationTestCaseFactory.remove(existingTestCase.OrchestrationTestCaseId);
          deletedCount++;
        }
      }

      for (let newTestCase of testCasesData) {
        newTestCase.ProjectId = orchestration.ProjectId;
        newTestCase.OrchestrationId = orchestration.OrchestrationId;
        console.log(newTestCase);
        await orchestrationTestCaseFactory.addOrUpdate(newTestCase);
        addedCount++;
      }
    }

    return {
      previous: previousCount,
      deleted: deletedCount,
      added: addedCount,
      current: previousCount + addedCount - deletedCount,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByProjectId,
  add,
  update,
  remove,
  removeByProjectId,
  getTestCases,
  updateTestCases,
};
