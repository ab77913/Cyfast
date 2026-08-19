"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const config = require("../config.js");
const orchestrationConfigurationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-configuration-factory");

/**
 * @description Get all orchestrations
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} orchestrations
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
 * GET /api/v1/orchestrations
 *
 * */

const getConfigurations = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const configs =
      await orchestrationConfigurationFactory.getByOrchestrationId(
        orchestrationId
      );

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addConfiguration = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const configData = req.body;

    const configs = await orchestrationConfigurationFactory.add(
      orchestrationId,
      configData
    );

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateConfiguration = async (req, res, next) => {
  try {
    const orchestrationConfigurationId =
      req.params.orchestrationConfigurationId;
    const orchestrationId = req.params.orchestrationId;
    const configData = req.body;

    const configs = await orchestrationConfigurationFactory.update(
      orchestrationId,
      configData
    );

    return res.status(200).json(configs);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteConfigurations = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const configs = await orchestrationConfigurationFactory.remove(
      orchestrationId
    );

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
//     const orchestrationId = req.params.orchestrationId;

//     configData.orchestrationId = orchestrationId;
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

//     const configs = await orchestrationConfigurationFactory.addOrUpdate(orchestrationId, configData);

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
