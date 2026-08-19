"use strict";

const helpers = require("../../../helpers");
const projectData = require("../data/projects");

// Fetch project by ID
const getById = async (projectId) => {
  const project = await projectData.getById(projectId);

  return project;
};

// Fetch configurations by Project ID
const getConfigurationsByProjectId = async (projectId) => {
  const configurations = await projectData.getConfigurationsByProjectId(
    projectId
  );

  return configurations;
};

module.exports = {
  getById,
  getConfigurationsByProjectId,
};
