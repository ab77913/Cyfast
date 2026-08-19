"use strict";

const config = require("../config.js");
const helpers = require("../helpers");
const testScriptFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-factory");

/**
 * @description Get all testScripts
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} testScripts
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
 * GET /api/v1/testScripts
 *
 * */

const getTestScripts = async (req, res, next) => {
  try {
    const { filters, sort, include, page, size } =
      helpers.parseListFetchQuery(req.query);

    const testScripts = await testScriptFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(testScripts);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestScript = async (req, res, next) => {
  try {
    const testScriptId = req.params.testScriptId;

    const testScript = await testScriptFactory.getById(testScriptId);

    return res.status(200).json(testScript);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addTestScript = async (req, res, next) => {
  try {
    //Write a code to Validate testScript data
    const testScriptData = req.body;
    testScriptData.status = "NEW";

    const testScript = await testScriptFactory.add(testScriptData);

    return res.status(200).json(testScript);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestScript = async (req, res, next) => {
  try {
    const testScriptId = req.params.testScriptId;
    const testScriptData = req.body;

    const testScript = await testScriptFactory.update(
      testScriptId,
      testScriptData
    );

    return res.status(200).json(testScript);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteTestScript = async (req, res, next) => {
  try {
    const testScriptId = req.params.testScriptId;

    const testScript = await testScriptFactory.remove(testScriptId);

    return res.status(200).json(testScript);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getTestScripts,
  getTestScript,
  addTestScript,
  updateTestScript,
  deleteTestScript,
};
