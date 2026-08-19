"use strict";

const helpers = require("../../../helpers");
const { Project, ProjectTestEnvironment } = require("../models");
const sequelize = require("sequelize");
const { Op } = require("sequelize");

const getByFilter = async (filters, sort = [], page = null, size = null, include = null) => {
  try {
    sort = sort.length > 0 ? sort : ["CreatedDate", "Desc"];
    let { limit, offset } = helpers.getPagination(page, size);

    const projects = await Project.findAll({
      limit: limit,
      offset: offset,
      where: filters,
      order: [sort],
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
        ProjectId: projectId,
      },
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
    filters.CreatedDate = {
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
    const project = await Project.destroy({
      where: {
        ProjectId: projectId,
      },
    });

    return project;
  } catch (error) {
    console.log(error);

    return null;
  }
};

//Test Environments

const getTestEnvironments = async (projectId, filters = {}) => {
  try {
    const project = await getById(projectId);
    if (!project) throw new Error("Project not found");

    const testEnvironments = await ProjectTestEnvironment.findAll({
      where: {
        ProjectId: projectId,
        ...filters,
      },
    });

    return testEnvironments;
  } catch (error) {
    console.log(error);

    return null;
  }
};

const updateTestEnvironments = async (projectId, testEnvironmentIds) => {
  try {
    const project = await getById(projectId);
    if (!project) throw new Error("Project not found");

    let existingTestEnvironments = await getTestEnvironments(projectId, {
      TestEnvironmentId: {
        [Op.in]: testEnvironmentIds,
      },
    });
    let existingTestEnvironmentIds = existingTestEnvironments.map((item) => item.TestEnvironmentId);
    let newTestEnvironmentIds = testEnvironmentIds.filter((item) => !existingTestEnvironmentIds.includes(item));

    let deleted = await ProjectTestEnvironment.destroy({
      where: {
        ProjectId: projectId,
        TestEnvironmentId: {
          [Op.notIn]: testEnvironmentIds,
        },
      },
    });

    let projectTestEnvironments = newTestEnvironmentIds.map((item) => {
      return {
        ProjectId: projectId,
        TestEnvironmentId: item,
      };
    });

    let added = await ProjectTestEnvironment.bulkCreate(projectTestEnvironments);

    return {
      deleted: deleted,
      added: projectTestEnvironments.length,
    };
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
  getTestEnvironments,
  updateTestEnvironments,
  getRecentlyAddedCount,
};
