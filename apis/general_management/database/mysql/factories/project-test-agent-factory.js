// Sorting:Ensure that the sort array is in the correct format. Sequelize expects sorting to be in the form of [['column', 'ASC/DESC']]
// getCountByFilter: Updated to use filters from getByFilter.
// addOrUpdate: Ensured correct usage of project_test_agent_id and fixed destructuring of getByFilter result.
// remove: Returns the number of deleted rows.

"use strict";

const helpers = require("../../../helpers");
const { ProjectTestAgent } = require("../models");

const getByFilter = async (filters, sort = [], page = null, size = null) => {
  try {
    page = page || 1;
    size = size || 10;

    // Ensure sorting format is correct
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    const projectTestAgents = await ProjectTestAgent.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (projectTestAgents && projectTestAgents.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: projectTestAgents,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const projectTestAgentsCount = await ProjectTestAgent.count({
      where: filters,
    });

    return projectTestAgentsCount;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getById = async (projectTestAgentId) => {
  try {
    const projectTestAgent = await ProjectTestAgent.findOne({
      where: {
        project_test_agent_id: projectTestAgentId,
      },
    });

    return projectTestAgent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByProjectId = async (projectId) => {
  try {
    const projectTestAgents = await ProjectTestAgent.findAll({
      where: {
        project_id: projectId,
      },
    });

    return projectTestAgents;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const getByTestAgentId = async (testAgentId) => {
  try {
    const projectTestAgents = await ProjectTestAgent.findAll({
      where: {
        test_agent_id: testAgentId,
      },
    });

    return projectTestAgents;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const add = async (projectTestAgentData) => {
  try {
    const projectTestAgent = await ProjectTestAgent.create(
      projectTestAgentData
    );

    return projectTestAgent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const update = async (projectTestAgentId, projectTestAgentData) => {
  try {
    const projectTestAgent = await getById(projectTestAgentId);
    if (!projectTestAgent) throw new Error("ProjectTestAgent not found");

    await projectTestAgent.update(projectTestAgentData);

    return projectTestAgent;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const addOrUpdate = async (projectTestAgentData) => {
  try {
    let { data: projectTestAgents } = await getByFilter({
      project_id: projectTestAgentData.project_id,
      test_agent_id: projectTestAgentData.test_agent_id,
    });

    if (projectTestAgents.length > 0) {
      return await update(
        projectTestAgents[0].project_test_agent_id,
        projectTestAgentData
      );
    } else {
      return await add(projectTestAgentData);
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const remove = async (projectTestAgentId) => {
  try {
    const rowsDeleted = await ProjectTestAgent.destroy({
      where: {
        project_test_agent_id: projectTestAgentId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByProjectId = async (projectId) => {
  try {
    const rowsDeleted = await ProjectTestAgent.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByTestAgentId = async (projectId) => {
  try {
    const rowsDeleted = await ProjectTestAgent.destroy({
      where: {
        test_agent_id: testAgentId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

const removeByFilter = async (filters) => {
  try {
    const rowsDeleted = await ProjectTestAgent.destroy({
      where: filters,
    });
    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  getByProjectId,
  getByTestAgentId,
  add,
  update,
  addOrUpdate,
  remove,
  removeByProjectId,
  removeByTestAgentId,
  removeByFilter,
};
