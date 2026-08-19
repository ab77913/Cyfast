"use strict";

const helpers = require("../../../helpers");
const testExecutionData = require("../data/testExecutions");

const getExecutionSummaryByProjectId = async (projectId) => {
  let executionSummary = await testExecutionData.getExecutionSummaryByProjectId(projectId);

  return executionSummary;
};

const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  let executionSummary = await testExecutionData.getExecutionSummaryByOrchestrationId(orchestrationId);

  return executionSummary;
};

const getExecutionLogsByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  let executionLogs = await testExecutionData.getExecutionLogsByOrchestrationExecutionId(orchestrationExecutionId);

  return executionLogs;
};

const getExecutionResultStatisticsByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  let executionResultStatistics = await testExecutionData.getExecutionResultStatisticsByOrchestrationExecutionId(orchestrationExecutionId);

  return executionResultStatistics;
};

module.exports = {
  getExecutionSummaryByProjectId,
  getExecutionSummaryByOrchestrationId,
  getExecutionLogsByOrchestrationExecutionId,
  getExecutionResultStatisticsByOrchestrationExecutionId,
};
