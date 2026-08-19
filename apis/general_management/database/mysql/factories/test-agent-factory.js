// Error Propagation: Ensure that errors are properly thrown to be handled by calling functions or middleware.
// Instance Methods: For updating and deleting records, it's recommended to first fetch the record and use instance methods for operations.
// Field Names: Ensure the field names like test_agent_id match your MySQL schema

"use strict";

const helpers = require("../../../helpers");
const { TestAgent } = require("../models");
const { Op } = require("sequelize");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    sort = sort.length > 0 ? sort : ["created_date", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const testAgents = await TestAgent.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (testAgents && testAgents.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: testAgents,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getCountByFilter = async (filters) => {
  try {
    const testAgentsCount = await TestAgent.count({
      where: filters,
    });

    return testAgentsCount;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getById = async (testAgentId) => {
  try {
    const testAgent = await TestAgent.findOne({
      where: {
        test_agent_id: testAgentId,
      },
      include: ["project_ids"],
    });

    return testAgent;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByIds = async (testAgentIds) => {
  try {
    const testAgents = await TestAgent.findAll({
      where: {
        test_agent_id: testAgentIds,
      },
    });

    return testAgents;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByName = async (testAgentName) => {
  try {
    const testAgent = await TestAgent.findOne({
      where: {
        name: testAgentName,
      },
    });

    return testAgent;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getByNames = async (testAgentNames) => {
  try {
    const testAgents = await TestAgent.findAll({
      where: {
        name: testAgentNames,
      },
    });

    return testAgents;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getAlive = async (projectId = null) => {
  try {
    const testAgents = await TestAgent.findAll({
      where: {
        status: {
          [Op.ne]: "DEAD",
        },
      },
    });

    return testAgents;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const getAvailableForParsing = async (projectId = null) => {
  try {
    const testAgents = await TestAgent.findAll({
      where: {
        status: "READY",
      },
    });

    return testAgents.length > 0 ? testAgents[0] : null;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const add = async (testAgentData) => {
  try {
    const testAgent = await TestAgent.create(testAgentData);

    return testAgent;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const update = async (testAgentId, testAgentData) => {
  try {
    const testAgent = await getById(testAgentId);
    if (!testAgent) throw new Error("TestAgent not found");

    await testAgent.update(testAgentData);

    return testAgent;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

const remove = async (testAgentId) => {
  try {
    const testAgent = await getById(testAgentId);
    if (!testAgent) throw new Error("TestAgent not found");

    await TestAgent.destroy({
      where: {
        test_agent_id: testAgentId,
      },
    });

    return testAgent;
  } catch (error) {
    console.log(error);
    throw error; // Ensure errors are propagated correctly
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByIds,
  getByName,
  getByNames,
  getAlive,
  getAvailableForParsing,
  add,
  update,
  remove,
};
