"use strict";

const requirementData = require("../data/requirements/");

const getExecutionStats = async (projectId) => {
  try {
    let executionStats = await requirementData.getExecutionStats(projectId);

    return executionStats && executionStats.length > 0 ? executionStats[0] : null;
  } catch (error) {
    console.log(error);
  }
};

const getMostFailed = async (projectId) => {
  try {
    let mostFailed = await requirementData.getMostFailed(projectId);

    return mostFailed;
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  getExecutionStats,
  getMostFailed,
};
