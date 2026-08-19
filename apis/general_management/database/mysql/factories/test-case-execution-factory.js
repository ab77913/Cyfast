// Fixed Typo: Corrected getFrequestFailuresCount to getFrequentFailuresCount.
// Pagination Defaults: Ensured default values for page and size are correctly handled.
// Error Handling: Improved error handling for database operations.
// Field Names: Verified that field names like test_case_execution_id and orchestration_execution_id match your model definitions.

"use strict";

const dayjs = require("dayjs");
const sequelize = require("sequelize");
const helpers = require("../../../helpers");
const { TestCaseExecution } = require("../models");
const testCaseData = require("../data/test-cases");
const testCaseExecutionData = require("../data/test-case-executions");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    sort = sort.length > 0 ? sort : ["created_date", "DESC"];
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
    let executionStats = await testCaseData.getExecutionStats(
      projectId,
      orchestrationId
    );
    console.log(executionStats);

    return executionStats && executionStats.length > 0
      ? executionStats[0]
      : null;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getExecutionTrendByOrchestrationId = async (
  orchestrationId,
  fromDate
) => {
  try {
    let executionTrend = await testCaseData.getExecutionTrendByOrchestrationId(
      orchestrationId,
      fromDate
    );

    return executionTrend;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getMostFailed = async (projectId) => {
  try {
    let mostFailed = await testCaseData.getMostFailed(projectId);

    return mostFailed;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const getInProgressCount = async () => {
  try {
    let testsInProgress = await TestCaseExecution.findAll({
      attributes: [
        "test_case_id",
        [
          sequelize.fn("COUNT", sequelize.col("test_case_id")),
          "in_progress_count",
        ],
      ],
      where: { status: "INPROGRESS" },
      group: ["test_case_id"],
    });

    return testsInProgress.length;
  } catch (error) {
    console.log(error);

    return 0; // Return 0 if there is an error
  }
};

const getFrequentFailuresCount = async () => {
  // Fixed typo from `getFrequestFailuresCount`
  try {
    let frequentlyFailedTests = await TestCaseExecution.findAll({
      attributes: [
        "test_case_id",
        [sequelize.fn("COUNT", sequelize.col("test_case_id")), "failed_count"],
      ],
      where: { status: "FAILED" },
      group: ["test_case_id"],
      having: sequelize.literal("COUNT(test_case_id) > 1"),
    });

    return frequentlyFailedTests.length;
  } catch (error) {
    console.log(error);

    return 0; // Return 0 if there is an error
  }
};

const getExecutionSummaryByProjectId = async (projectId) => {
  let executionSummary =
    await testCaseExecutionData.getExecutionSummaryByProjectId(projectId);

  return executionSummary;
};

const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  let executionSummary =
    await testCaseExecutionData.getExecutionSummaryByOrchestrationId(
      orchestrationId
    );

  return executionSummary;
};

const getExecutionResultStatisticsByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  let executionResultStatistics =
    await testCaseExecutionData.getExecutionResultStatisticsByOrchestrationExecutionId(
      orchestrationExecutionId
    );

  return executionResultStatistics;
};

const getById = async (testCaseExecutionId) => {
  try {
    const testCaseExecution = await TestCaseExecution.findOne({
      where: {
        test_case_execution_id: testCaseExecutionId, // Ensure this matches the model's field
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
        orchestration_execution_id: orchestrationExecutionId,
      },
    });

    return testCaseExecutions;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const add = async (testCaseExecutionData) => {
  console.log("testCaseExecutionData", testCaseExecutionData);
  try {
    if (!testCaseExecutionData.test_case_execution_id) {
      testCaseExecutionData["test_case_execution_id"] =
        testCaseExecutionData.test_case_id +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
    }
    const testCaseExecution = await TestCaseExecution.create(
      testCaseExecutionData
    );

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

    await testCaseExecution.update(testCaseExecutionData); // Use instance method for update

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
    let testCaseExecution = await TestCaseExecution.findOne({
      where: filters,
    });

    if (testCaseExecution) {
      await testCaseExecution.update(testCaseExecutionData);
    } else {
      testCaseExecutionData["test_case_execution_id"] =
        testCaseExecutionData.test_case_id +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      testCaseExecution = await TestCaseExecution.create(testCaseExecutionData);
    }

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return false;
  }
};

const remove = async (testCaseExecutionId) => {
  try {
    const testCaseExecution = await getById(testCaseExecutionId);
    if (!testCaseExecution) throw new Error("Test Execution not found");

    await testCaseExecution.destroy(); // Use instance method for destruction

    return testCaseExecution;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByTestCaseId = async (testCaseId) => {
  try {
    const rowsDeleted = await TestCaseExecution.destroy({
      where: {
        test_case_id: testCaseId,
      },
    });

    return rowsDeleted;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const removeByOrchestrationId = async (orchestrationExecutionId) => {
  try {
    const rowsDeleted = await TestCaseExecution.destroy({
      where: {
        orchestration_execution_id: orchestrationExecutionId,
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
    const rowsDeleted = await TestCaseExecution.destroy({
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
  getExecutionStats,
  getMostFailed,
  getExecutionTrendByOrchestrationId,
  getInProgressCount,
  getFrequentFailuresCount, // Fixed typo
  getExecutionSummaryByProjectId,
  getExecutionSummaryByOrchestrationId,
  getExecutionResultStatisticsByOrchestrationExecutionId,
  getById,
  getByOrchestrationExecutionId,
  add,
  addOrUpdateByFilter,
  update,
  updateByFilter,
  remove,
  removeByTestCaseId,
  removeByOrchestrationId,
  removeByProjectId,
};
