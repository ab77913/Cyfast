"use strict";

const config = require("../config.js");

const testAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-agent-factory");
const mqProducer = require("../messaging/" + config.mq_type + "/mq-producer");

const requestParseTestCases = async (sourceData) => {
  try {
    const mqMessage = {
      test_cases_source: {
        type: sourceData.source_type,
        directory_path: sourceData.source_path,
        suite_name: sourceData.suite_name,
        configs: {
          username: sourceData.access_username,
          password: sourceData.access_password,
          access_token: sourceData.access_token,
          branch: sourceData.repository_branch_name,
          url: sourceData.repository_server_url,
          repository_type: sourceData.repository_type,
        },
      },
      test_fw_type: sourceData.test_framework,
      project_id: sourceData.project_id,
      test_source_id: sourceData.test_source_id,
      user_id: "admin", //TODO - get from session
    };

    const availableTestAgent = await testAgentFactory.getAvailableForParsing();
    if (availableTestAgent) {
      console.log(
        "Sending test cases import request to - ",
        availableTestAgent.name
      );
      mqProducer.sendToExchange(
        config.mq_exchanges.agent_parsing_request,
        "topic",
        availableTestAgent.name + ".*",
        JSON.stringify(mqMessage)
      );
    } else {
      throw new Error("No agent is available to parse and import tests.");
    }

    return true;
  } catch (error) {
    console.log("Error while sending project config update message - ", error);

    throw error; // Ensure errors are propagated correctly
  }
};

module.exports = {
  requestParseTestCases: requestParseTestCases,
};
