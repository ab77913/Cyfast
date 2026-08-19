"use strict";

const config = require("../config.js");
const projectFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-factory");
const projectConfigurationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-configuration-factory");
const projectService = require("../services/project-service.js");

/**
 * @description Get all projects
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} projects
 * @todo Add authentication
 * @todo Add authorization
 * @todo Add pagination
 * @todo Add search
 * @todo Add sort
 * @todo Add filter
 * @todo Add validation
 * @todo Add error handling
 * @todo Add logging
 * @todo Add unit tests
 * @todo Add integration tests
 * @todo Add e2e tests
 * @todo Add caching
 * @todo Add monitoring
 * @example
 * GET /api/v1/projects
 *
 * */

const getProjects = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const projects = await projectFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );
    // console.log(projectFactory)

    return res.status(200).json(projects);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const project = await projectFactory.getById(projectId);

    return res.status(200).json(project);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getProjectSummary = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const projectSummary = await projectService.getProjectSummary(projectId);

    return res.status(200).json(projectSummary);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addProject = async (req, res, next) => {
  try {
    //Write a code to Validate project data
    const projectData = req.body;
    projectData.status = "NEW";

    const project = await projectFactory.add(projectData);

    return res.status(200).json(project);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const projectData = req.body;

    const project = await projectFactory.update(projectId, projectData);

    return res.status(200).json(project);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const project = await projectService.removeProjectData(projectId);

    return res.status(200).json(project);
  } catch (error) {
    return res.status(500).json(error);
  }
};

//Project Test Agents

const getTestAgents = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const testAgents = await projectFactory.getTestAgents(projectId);

    return res.status(200).json(testAgents);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestAgents = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const testAgentData = req.body;

    const updatedTestAgents = await projectFactory.updateTestAgents(
      projectId,
      testAgentData
    );

    return res.status(200).json(updatedTestAgents);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const detachTestAgent = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const testAgentId = req.params.testAgentId;

    //TODO - remove test agent and project mapping
    return res.status(200).json(null);
  } catch (error) {
    return res.status(500).json(error);
  }
};

// Project Configurations

const getConfiguration = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const config = await projectConfigurationFactory.getByProjectId(projectId);

    return res.status(200).json(config);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateConfiguration = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const configData = req.body;

    const config = await projectConfigurationFactory.updateByProjectId(
      projectId,
      configData
    );

    return res.status(200).json(config);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteConfiguration = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    const config = await projectConfigurationFactory.removeByProjectId(
      projectId
    );

    return res.status(200).json(config);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getProjects,
  getProject,
  getProjectSummary,
  addProject,
  updateProject,
  deleteProject,
  getTestAgents,
  updateTestAgents,
  getConfiguration,
  updateConfiguration,
  deleteConfiguration,
  detachTestAgent,
};
