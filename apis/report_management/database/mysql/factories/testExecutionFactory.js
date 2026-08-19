"use strict";

const helpers = require("../../../helpers");
const testExecutionData = require("../data/testExecutions");

// Fetch execution summary by project ID
const getExecutionSummaryByProjectId = async (projectId) => {
  let executionSummary = await testExecutionData.getExecutionSummaryByProjectId(
    projectId
  );

  return executionSummary;
};

// Fetch execution summary by orchestration ID
const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  let executionSummary =
    await testExecutionData.getExecutionSummaryByOrchestrationId(
      orchestrationId
    );

  return executionSummary;
};

// Fetch execution logs by orchestration execution ID
const getExecutionLogsByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  let executionLogs =
    await testExecutionData.getExecutionLogsByOrchestrationExecutionId(
      orchestrationExecutionId
    );

  return executionLogs;
};

// Fetch execution result statistics by orchestration execution ID
const getExecutionResultStatisticsByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  let executionResultStatistics =
    await testExecutionData.getExecutionResultStatisticsByOrchestrationExecutionId(
      orchestrationExecutionId
    );

  return executionResultStatistics;
};

module.exports = {
  getExecutionSummaryByProjectId,
  getExecutionSummaryByOrchestrationId,
  getExecutionLogsByOrchestrationExecutionId,
  getExecutionResultStatisticsByOrchestrationExecutionId,
};
