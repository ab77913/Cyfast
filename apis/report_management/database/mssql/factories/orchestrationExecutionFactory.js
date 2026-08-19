"use strict";

const helpers = require("../../../helpers");
const orchestrationExecutionData = require("../data/orchestrationExecutions");

const getById = async (orchestrationExecutionId) => {
  let orchestrationExecution = await orchestrationExecutionData.getById(orchestrationExecutionId);

  return orchestrationExecution;
};

const getLatestByOrchestrationId = async (orchestrationId) => {
  let orchestrationExecution = await orchestrationExecutionData.getLatestByOrchestrationId(orchestrationId);

  return orchestrationExecution;
};

module.exports = {
  getById,
  getLatestByOrchestrationId,
};
