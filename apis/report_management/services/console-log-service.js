"use strict";

const config = require("../config.js");
const axios = require("axios");

const getConsoleLogByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  try {
    let url =
      config.loggerServiceUrl +
      "/logs/console?page=1&size=100&sort[created_date]=asc&filters[orchestration_execution_id]=" +
      orchestrationExecutionId;
    let response = await axios.get(url);

    return response.data && response.data.data !== undefined
      ? response.data.data.log_text
      : "";
  } catch (error) {
    console.log(error);

    return "";
  }
};

module.exports = {
  getConsoleLogByOrchestrationExecutionId,
};
