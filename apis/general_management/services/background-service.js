"use strict";

const config = require("../config.js");

const testAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-agent-factory");

const monitorTestAgents = async () => {
  try {
    const runningTestAgents = await testAgentFactory.getAlive();
    if (Array.isArray(runningTestAgents) && runningTestAgents.length > 0) {
      const now = Date.now();
      for (let testAgent of runningTestAgents) {
        console.log(`Monitoring test agent: ${testAgent.name}`);
        const lastHeartbeat = new Date(testAgent.last_heartbeat).getTime();
        if (now - lastHeartbeat > 10000) {
          // Mark status as dead
          await testAgentFactory.update(testAgent.test_agent_id, {
            status: "DEAD",
          });
          console.log(`Test agent ${testAgent.name} marked as dead.`);
        }
      }
    }
  } catch (error) {
    console.log("Error while monitoring test agents - ", error);

    throw error; // Ensure errors are propagated correctly
  }
};

module.exports = {
  monitorTestAgents,
};
