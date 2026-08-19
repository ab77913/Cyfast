"use strict";

const dayjs = require("dayjs");
const sequelize = require("sequelize");
const helpers = require("../../../helpers");
const { TestCaseExecution } = require("../models");
const testCaseData = require("../data/testCases/");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testCaseExecutions = await TestCaseExecution.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
    });

    console.log("testCaseExecutions", testCaseExecutions);

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testCaseExecutions && testCaseExecutions.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: testCaseExecutions,
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
    const testCaseExecutionsCount = await TestCaseExecution.count({
      where: filters,
    });

    return testCaseExecutionsCount;
  } catch (error) {
    console.log(error);

    return 0;
  }
};

const getExecutionStats = async (projectId, orchestrationId) => {
  try {
    let executionStats = await testCaseData.getExecutionStats(projectId, orchestrationId);

    return executionStats && executionStats.length > 0 ? executionStats[0] : null;
  } catch (error) {
    console.log(error);
  }
};

const getExecutionTrendByOrchestrationId = async (orchestrationId, fromDate) => {
  try {
    let executionTrend = await testCaseData.getExecutionTrendByOrchestrationId(orchestrationId, fromDate);

    return executionTrend;
  } catch (error) {
    console.log(error);
  }
};

const getMostFailed = async (projectId) => {
  try {
    let mostFailed = await testCaseData.getMostFailed(projectId);

    return mostFailed;
  } catch (error) {
    console.log(error);
  }
};

const getInProgressCount = async () => {
  try {
    let testsInProgress = await TestCaseExecution.findAll({
      attributes: ["TestCaseId", [sequelize.fn("COUNT", sequelize.col("TestCaseId")), "InProgressCount"]],
      where: { Status: "INPROGRESS" },
      group: ["TestCaseId"],
    });

    return testsInProgress.length;
  } catch (error) {
    console.log(error);
  }
};

const getFrequestFailuresCount = async () => {
  try {
    let frequentlyFailedTests = await TestCaseExecution.findAll({
      attributes: ["TestCaseId", [sequelize.fn("COUNT", sequelize.col("TestCaseId")), "FailedCount"]],
      where: { Status: "FAILED" },
      group: ["TestCaseId"],
      having: sequelize.literal("COUNT(TestCaseId) > 1"),
    });

    return frequentlyFailedTests.length;
  } catch (error) {
    console.log(error);
  }
};

const getById = async (testCaseExecutionId) => {
  try {
    const testCaseExecution = await TestCaseExecution.findOne({
      where: {
        TestCaseExecutionId: testCaseExecutionId,
      },
    });

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  try {
    const testCaseExecutions = await TestCaseExecution.findAll({
      where: {
        OrchestrationExecutionId: orchestrationExecutionId,
      },
    });

    return testCaseExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getByOrchestrationExecutionIdAndTestCaseId = async (orchestrationExecutionId, testCaseId) => {
  try {
    const testCaseExecution = await TestCaseExecution.findOne({
      where: {
        OrchestrationExecutionId: orchestrationExecutionId,
        TestCaseExecutionId: testCaseId,
      },
    });

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (testCaseExecutionData) => {
  console.log("testCaseExecutionData", testCaseExecutionData);
  try {
    if (testCaseExecutionData.TestCaseExecutionId == undefined) {
      testCaseExecutionData["TestCaseExecutionId"] =
        testCaseExecutionData.TestCaseId +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
    }
    const testCaseExecution = await TestCaseExecution.create(testCaseExecutionData);

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const update = async (testCaseExecutionId, testCaseExecutionData) => {
  try {
    const testCaseExecution = await getById(testCaseExecutionId);
    if (!testCaseExecution) throw new Error("Test Execution not found");

    await testCaseExecution.update(testCaseExecutionData);

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const updateByFilter = async (filters, testCaseExecutionData) => {
  try {
    await TestCaseExecution.update(testCaseExecutionData, {
      where: filters,
    });

    return true;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const addOrUpdateByFilter = async (filters, testCaseExecutionData) => {
  try {
    const testCaseExecution = await TestCaseExecution.findOne({
      where: filters,
    });

    if (testCaseExecution) {
      await TestCaseExecution.update(testCaseExecutionData, {
        where: filters,
      });
    } else {
      testCaseExecutionData["TestCaseExecutionId"] =
        testCaseExecutionData.TestCaseId +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      await TestCaseExecution.create(testCaseExecutionData);
    }

    return true;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const remove = async (testCaseExecutionId) => {
  try {
    const testCaseExecution = await getById(testCaseExecutionId);
    if (!testCaseExecution) throw new Error("Test Execution not found");

    await testCaseExecution.destroy();

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const deletedTestCaseExecutions = await TestCaseExecution.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return deletedTestCaseExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationId) => {
  try {
    const deletedTestCaseExecutions = await TestCaseExecution.destroy({
      where: {
        OrchestrationId: orchestrationId,
      },
    });

    return deletedTestCaseExecutions;
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
  getByOrchestrationExecutionIdAndTestCaseId,
  add,
  addOrUpdateByFilter,
  update,
  updateByFilter,
  remove,
  getExecutionStats,
  getMostFailed,
  getExecutionTrendByOrchestrationId,
  getInProgressCount,
  getFrequestFailuresCount,
  removeByProjectId,
  removeByOrchestrationId,
};
