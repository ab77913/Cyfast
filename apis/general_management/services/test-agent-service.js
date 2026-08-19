"use strict";

const config = require("../config.js");
const crypto = require("crypto");

const testAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-agent-factory");
const projectTestAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-test-agent-factory");

const mqProducer = require("../messaging/" + config.mq_type + "/mq-producer");

const registerTestAgent = async (agentData) => {
  try {
    if (!agentData || !agentData.agent_name) {
      throw new Error("Invalid agent data provided for registration.");
    }

    let agentDetails = {
      organization_id: 1, //Temporary organization id
      name: agentData.agent_name,
      type: agentData.agent_type,
      host_name: agentData.host.name,
      host_os: agentData.host.os,
      supported_execution_modes: agentData.supported_execution_mode.join(","),
      supported_execution_bases: agentData.supported_execution_base.join(","),
      status: "REGISTERED",
    };

    // Check if the agent already exists using agent_name
    let testAgent = await testAgentFactory.getByName(agentDetails.name);
    if (testAgent) {
      if (testAgent.status == "REGISTERING" || testAgent.status == "DEAD") {
        console.log("Updating already registered agent - ", agentDetails.name);
        testAgent = await testAgentFactory.update(
          testAgent.test_agent_id,
          agentDetails
        );
        console.log("Existing agent updated - ", testAgent);
      } else {
        throw new Error(
          "Agent already exists with valid state. Agent can not be registered again."
        );
      }
    } else {
      // If the agent does not exist, create a new one
      console.log("Registering new test agent - ", agentDetails);
      agentDetails.test_agent_id = crypto.randomBytes(16).toString("hex");
      testAgent = await testAgentFactory.add(agentDetails);
    }

    mqProducer.sendToExchange(
      config.mq_exchanges.agent_registration_acknowledgement,
      "topic",
      testAgent.name + ".*",
      JSON.stringify({ agent_id: testAgent.test_agent_id })
    );

    return testAgent;
  } catch (error) {
    console.log("Error while registering test agent - ", error);
    return false;
  }
};

const updateHeartbeat = async (agentData) => {
  try {
    if (!agentData) {
      throw new Error("Invalid agent ID provided for heartbeat update.");
    }
    // Update the heartbeat timestamp for the agent
    const updatedAgent = await testAgentFactory.update(agentData.agent_id, {
      last_heartbeat: Date.now(),
      status: agentData.status,
    });
    if (!updatedAgent) {
      throw new Error(
        "Failed to update heartbeat for agent with ID - " + agentData.agent_id
      );
    }
    return updatedAgent;
  } catch (error) {
    console.log("Error while updating heartbeat for test agent - ", error);
    return false;
  }
};

const requestStopTestAgent = async (testAgent) => {
  try {
    if (testAgent) {
      const mqMessage = { command: "kill" };
      console.log("Sending test cases import request to - ", testAgent.name);
      mqProducer.sendToExchange(
        config.mq_exchanges.agent_parsing_request,
        "topic",
        testAgent.name + ".*",
        JSON.stringify(mqMessage)
      );
    } else {
      throw new Error("No agent is available to parse and import tests.");
    }
    return updatedAgent;
  } catch (error) {
    console.log("Error while updating heartbeat for test agent - ", error);
    return false;
  }
};

const mapProjects = async (testAgent, projectIds) => {
  try {
    const existingMappedProjects = testAgent.project_ids || [];
    console.log(
      "Existing mapped projects - ",
      existingMappedProjects.map((mapping) => mapping.project_id)
    );
    // Initialize an empty array to hold mappings to remove
    let mappingsToRemove = [];
    if (existingMappedProjects && existingMappedProjects.length > 0) {
      // Remove existing projects if they are not in the new list
      mappingsToRemove = existingMappedProjects.filter(
        (existingProject) => !projectIds.includes(existingProject.project_id)
      );
      console.log(
        "Removing existing projects - ",
        mappingsToRemove.map((mapping) => mapping.project_id)
      );
      mappingsToRemove.forEach(async (mappedProject) => {
        await projectTestAgentFactory.removeByFilter({
          test_agent_id: testAgent.test_agent_id,
          project_id: mappedProject.project_id,
        });
      });
    }

    // Add or update test cases
    const mappedProjects = projectIds.map((projectId) => {
      return projectTestAgentFactory.addOrUpdate({
        test_agent_id: testAgent.test_agent_id,
        project_id: projectId,
      });
    });

    return mappedProjects;
  } catch (error) {
    console.log("Error while updating orchestration test cases - ", error);
    return false;
  }
};

module.exports = {
  registerTestAgent,
  updateHeartbeat,
  requestStopTestAgent,
  mapProjects,
};
