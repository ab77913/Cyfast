"use strict";

const helpers = require("../../../helpers");
const orchestrationData = require("../data/orchestrations");

// Fetch orchestration by ID
const getById = async (orchestrationId) => {
  const orchestration = await orchestrationData.getById(orchestrationId);

  return orchestration;
};

// Fetch configurations by Orchestration ID
const getConfigurationsByOrchestrationId = async (orchestrationId) => {
  const configurations =
    await orchestrationData.getConfigurationsByOrchestrationId(orchestrationId);

  return configurations;
};

module.exports = {
  getById,
  getConfigurationsByOrchestrationId,
};
