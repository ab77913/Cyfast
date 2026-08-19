"use strict";

const dayjs = require("dayjs");
const helpers = require("../../../helpers");
const { TestScriptExecution } = require("../models");
const testScriptData = require("../data/testScripts/");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testScriptExecutions = await TestScriptExecution.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
    });

    console.log("testScriptExecutions", testScriptExecutions);

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testScriptExecutions && testScriptExecutions.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: testScriptExecutions,
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
    const testScriptExecutionsCount = await TestScriptExecution.count({
      where: filters,
    });

    return testScriptExecutionsCount;
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getExecutionStats = async (projectId, orchestrationId) => {
  try {
    let executionStats = await testScriptData.getExecutionStats(projectId, orchestrationId);

    return executionStats && executionStats.length > 0 ? executionStats[0] : null;
  } catch (error) {
    console.log(error);
  }
};

const getMostFailed = async (projectId) => {
  try {
    let mostFailed = await testScriptData.getMostFailed(projectId);

    return mostFailed;
  } catch (error) {
    console.log(error);
  }
};

const getById = async (testScriptExecutionId) => {
  try {
    const testScriptExecution = await TestScriptExecution.findOne({
      where: {
        testScriptExecutionId: testScriptExecutionId,
      },
    });

    return testScriptExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  try {
    const testScriptExecutions = await TestScriptExecution.findAll({
      where: {
        OrchestrationExecutionId: orchestrationExecutionId,
      },
    });

    return testScriptExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (testScriptExecutionData) => {
  console.log("testScriptExecutionData", testScriptExecutionData);
  try {
    if (testScriptExecutionData.TestScriptExecutionId == undefined) {
      testScriptExecutionData["TestScriptExecutionId"] =
        testScriptExecutionData.TestScriptId +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
    }
    const testScriptExecution = await TestScriptExecution.create(testScriptExecutionData);

    return testScriptExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const update = async (testScriptExecutionId, testScriptExecutionData) => {
  try {
    const testScriptExecution = await getById(testScriptExecutionId);
    if (!testScriptExecution) throw new Error("Test Execution not found");

    await TestScriptExecution.update(testScriptExecutionData);

    return testScriptExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const updateByFilter = async (filters, testScriptExecutionData) => {
  try {
    await TestScriptExecution.update(testScriptExecutionData, {
      where: filters,
    });

    return true;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const addOrUpdateByFilter = async (filters, testScriptExecutionData) => {
  try {
    const testScriptExecution = await TestScriptExecution.findOne({
      where: filters,
    });

    if (testScriptExecution) {
      await TestScriptExecution.update(testScriptExecutionData, {
        where: filters,
      });
    } else {
      testScriptExecutionData["TestScriptExecutionId"] =
        testScriptExecutionData.TestScriptId +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      await TestScriptExecution.create(testScriptExecutionData);
    }

    return true;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const remove = async (testScriptExecutionId) => {
  try {
    const testScriptExecution = await getById(testScriptExecutionId);
    if (!testScriptExecution) throw new Error("Test Execution not found");

    await testScriptExecution.destroy();

    return testScriptExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedTestScriptExecutions = await TestScriptExecution.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedTestScriptExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const deletedTestScriptExecutions = await TestScriptExecution.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return deletedTestScriptExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByOrchestrationExecutionId,
  add,
  addOrUpdateByFilter,
  update,
  updateByFilter,
  remove,
  getExecutionStats,
  getMostFailed,
  removeByProjectId,
  removeByOrchestrationId,
};
