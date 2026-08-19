"use strict";

const helpers = require("../../../helpers");
const orchestrationExecutionData = require("../data/orchestrationExecutions");

// Fetch orchestration execution by ID
const getById = async (orchestrationExecutionId) => {
  let orchestrationExecution = await orchestrationExecutionData.getById(
    orchestrationExecutionId
  );

  return orchestrationExecution;
};

// Fetch the latest orchestration execution by Orchestration ID
const getLatestByOrchestrationId = async (orchestrationId) => {
  let orchestrationExecution =
    await orchestrationExecutionData.getLatestByOrchestrationId(
      orchestrationId
    );

  return orchestrationExecution;
};

module.exports = {
  getById,
  getLatestByOrchestrationId,
};
