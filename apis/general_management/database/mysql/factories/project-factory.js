// Sorting: Changed default sort format to [['created_date', 'DESC']].
// Pagination: Ensure helpers.getPagination is correctly implemented
// Transactions: Added transaction management to updateTestAgents to ensure atomicity.

"use strict";

const helpers = require("../../../helpers");
const {
  Project,
  ProjectTestAgent,
  ProjectUser,
  ProjectConfiguration,
  ProjectCustomConfiguration,
} = require("../models");
const { Op } = require("sequelize");

const getByFilter = async (
  filters,
  sort = [],
  page = null,
  size = null,
  include = null
) => {
  try {
    // Ensure sorting format is correct
    sort = sort.length > 0 ? sort : [["created_date", "DESC"]];
    let { limit, offset } = helpers.getPagination(page, size);

    const projects = await Project.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: sort,
      include: include,
    });

    let pagination = {};
    const totalItems = await getCountByFilter(filters);
    if (projects && projects.length > 0) {
      pagination = {
        totalItems: totalItems,
        totalPages: Math.ceil(totalItems / size),
        currentPage: page,
      };
    }

    return {
      data: projects,
      pagination: pagination,
    };
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getCountByFilter = async (filters) => {
  try {
    const projectsCount = await Project.count({
      where: filters,
    });

    return projectsCount;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getById = async (projectId) => {
  try {
    const project = await Project.findOne({
      where: {
        project_id: projectId,
      },
      include: [
        {
          model: ProjectTestAgent,
          as: "test_agents",
        },
        {
          model: ProjectUser,
          as: "users",
        },
        {
          model: ProjectConfiguration,
          as: "configuration",
        },
        {
          model: ProjectCustomConfiguration,
          as: "custom_configurations",
        },
      ],
    });

    return project;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getRecentlyAddedCount = async (filters) => {
  try {
    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
    filters.created_date = {
      [Op.gt]: sevenDaysAgo,
    };

    const recentlyAddedCount = await getCountByFilter(filters);

    return recentlyAddedCount;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const add = async (projectData) => {
  try {
    const project = await Project.create(projectData);

    return project;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const update = async (projectId, projectData) => {
  try {
    const project = await getById(projectId);
    if (!project) throw new Error("Project not found");

    await project.update(projectData);

    return project;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const remove = async (projectId) => {
  try {
    const rowsDeleted = await Project.destroy({
      where: {
        project_id: projectId,
      },
    });

    return rowsDeleted; // Return the number of deleted rows
  } catch (error) {
    console.log(error);
    return null;
  }
};

// Test Agents

const getTestAgents = async (projectId, filters = {}) => {
  try {
    const project = await getById(projectId);
    if (!project) throw new Error("Project not found");

    const testAgents = await ProjectTestAgent.findAll({
      where: {
        project_id: projectId,
        ...filters,
      },
    });

    return testAgents;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const updateTestAgents = async (projectId, testAgentIds) => {
  try {
    const project = await getById(projectId);
    if (!project) throw new Error("Project not found");

    const existingTestAgents = await getTestAgents(projectId, {
      test_agent_id: {
        [Op.in]: testAgentIds,
      },
    });

    const existingTestAgentIds = existingTestAgents.map(
      (item) => item.TestAgentId
    );
    const newTestAgentIds = testAgentIds.filter(
      (item) => !existingTestAgentIds.includes(item)
    );

    // Use a transaction to ensure atomicity
    const transaction = await sequelize.transaction();

    try {
      const deleted = await ProjectTestAgent.destroy({
        where: {
          project_id: projectId,
          test_agent_id: {
            [Op.notIn]: testAgentIds,
          },
        },
        transaction,
      });

      const projectTestAgents = newTestAgentIds.map((item) => ({
        project_id: projectId,
        test_agent_id: item,
      }));

      const added = await ProjectTestAgent.bulkCreate(projectTestAgents, {
        transaction,
      });

      await transaction.commit();

      return {
        deleted: deleted,
        added: projectTestAgents.length,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
};

const detachTestAgent = async (projectId, testAgentId) => {
  try {
    const detached = await ProjectTestAgent.destroy({
      where: {
        project_id: projectId,
        test_agent_id: testAgentId,
      },
    });

    return detached;
  } catch (error) {
    console.log(error);
    return null;
  }
};

module.exports = {
  getByFilter,
  getCountByFilter,
  getById,
  add,
  update,
  remove,
  getTestAgents,
  updateTestAgents,
  getRecentlyAddedCount,
};
