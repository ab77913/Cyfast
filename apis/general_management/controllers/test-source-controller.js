"use strict";

const config = require("../config.js");
const testSourceFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-source-factory");

const testService = require("../services/test-service.js");

/**
 * @description Get all testSources
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} testSources
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
 * GET /api/v1/testSources
 *
 * */

const getTestSources = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const testSources = await testSourceFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(testSources);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestSource = async (req, res, next) => {
  try {
    const testSourceId = req.params.testSourceId;

    const testSource = await testSourceFactory.getById(testSourceId);

    return res.status(200).json(testSource);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addTestSource = async (req, res, next) => {
  try {
    //Write a code to Validate testSource data
    const testSourceData = req.body;
    testSourceData.status = "NEW";
    testSourceData.organization_id = 1;

    const testSource = await testSourceFactory.add(testSourceData);

    return res.status(200).json(testSource);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestSource = async (req, res, next) => {
  try {
    const testSourceId = req.params.testSourceId;
    const testSourceData = req.body;

    const testSource = await testSourceFactory.update(
      testSourceId,
      testSourceData
    );

    return res.status(200).json(testSource);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteTestSource = async (req, res, next) => {
  try {
    const testSourceId = req.params.testSourceId;

    const testSource = await testSourceFactory.remove(testSourceId);

    return res.status(200).json(testSource);
  } catch (error) {
    return res.status(500).json(error);
  }
};

// Set default test source
const setDefaultTestSource = async (req, res, next) => {
  try {
    const testSourceId = req.params.testSourceId;

    const updatedTestSource = await testSourceFactory.setDefault(testSourceId);

    return res.status(200).json(updatedTestSource);
  } catch (error) {
    return res.status(500).json(error);
  }
};

// Import test cases from test source
const importTestCases = async (req, res, next) => {
  try {
    const testSourceId = req.params.testSourceId;
    const testSource = await testSourceFactory.getById(testSourceId);
    if (!testSource) {
      return res.status(404).json({ message: "Test source not found" });
    }

    const importedTestCases = await testService.requestParseTestCases(
      testSource
    );

    return res.status(200).json(importedTestCases);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getTestSources,
  getTestSource,
  addTestSource,
  updateTestSource,
  deleteTestSource,
  setDefaultTestSource,
  importTestCases,
};
