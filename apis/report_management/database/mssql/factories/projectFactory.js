"use strict";

const helpers = require("../../../helpers");
const projectData = require("../data/projects");

const getById = async (projectId) => {
  const project = await projectData.getById(projectId);

  return project;
};

const getConfigurationsByProjectId = async (projectId) => {
  const configurations = await projectData.getConfigurationsByProjectId(projectId);

  return configurations;
};

module.exports = {
  getById,
  getConfigurationsByProjectId,
};
