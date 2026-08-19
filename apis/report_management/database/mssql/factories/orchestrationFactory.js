"use strict";

const helpers = require("../../../helpers");
const orchestrationData = require("../data/orchestrations");

const getById = async (orchestrationId) => {
  const orchestration = await orchestrationData.getById(orchestrationId);

  return orchestration;
};

const getConfigurationsByOrchestrationId = async (orchestrationId) => {
  const configurations = await orchestrationData.getConfigurationsByOrchestrationId(orchestrationId);

  return configurations;
};

module.exports = {
  getById,
  getConfigurationsByOrchestrationId,
};
