"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const config = require("../config.js");

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

const getConfigurations = async (req, res, next) => {
  try {
    let filters = {};
    filters.project_id = req.params.projectId;

    const configs = await projectConfigurationFactory.getByFilter(filters);

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addConfiguration = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const configData = req.body;
    configData.project_id = projectId;

    // Validate project Configuration already exists
    const existingConfig = await projectConfigurationFactory.getByProjectId(
      projectId
    );
    if (existingConfig) {
      return res.status(400).json({
        message: "Project configuration already exists for this project.",
      });
    }

    const configs = await projectConfigurationFactory.add(configData);

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateConfiguration = async (req, res, next) => {
  try {
    const projectConfigurationId = req.params.projectConfigurationId;
    const projectId = req.params.projectId;
    const configData = req.body;

    let configs = null;
    if (projectConfigurationId) {
      configs = await projectConfigurationFactory.update(
        projectConfigurationId,
        configData
      );
    } else {
      configs = await projectConfigurationFactory.updateByProjectId(
        projectId,
        configData
      );
    }

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteConfigurations = async (req, res, next) => {
  try {
    const projectConfigurationId = req.params.projectConfigurationId;
    const projectId = req.params.projectId;

    let configs = null;
    if (projectConfigurationId) {
      configs = await projectConfigurationFactory.remove(
        projectConfigurationId
      );
    } else {
      configs = await projectConfigurationFactory.removeByProjectId(projectId);
    }

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

// const importConfigurations = async (req, res, next) => {
//   try {
//     if (req.file == undefined) {
//       return res.status(400).send({
//         message: "Error occured while uploading file, Please upload a file!",
//       });
//     }

//     let configData = {};
//     const projectId = req.params.projectId;

//     configData.projectId = projectId;
//     configData.fileName = req.file.originalname;

//     let configDetails = {};
//     let extname = path.extname(req.file.originalname).toLowerCase();
//     if (extname == "json") {
//       configDetails = JSON.parse(fs.readFileSync(req.file.path, "utf8")).configurations;
//       configData.configurations = configDetails ? configDetails : {};
//     } else if (extname == "yaml" || extname == "yml") {
//       configDetails = yaml.load(fs.readFileSync(req.file.path, "utf8")).configurations;
//       configData.configurations = configDetails ? configDetails : {};
//     } else {
//       throw new Error("Invalid file type");
//     }

//     const configs = await projectConfigurationFactory.addOrUpdate(projectId, configData);

//     fs.unlinkSync(req.file.path);

//     return res.status(200).json(configs);
//   } catch (error) {
//     fs.unlinkSync(req.file.path);
//     return res.status(500).json(error);
//   }
// };

module.exports = {
  getConfigurations,
  addConfiguration,
  updateConfiguration,
  deleteConfigurations,
};
