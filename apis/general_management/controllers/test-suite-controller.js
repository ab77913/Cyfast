"use strict";

const config = require("../config.js");
const testSuiteFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-suite-factory");

/**
 * @description Get all testSuites
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} testSuites
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
 * GET /api/v1/testSuites
 *
 * */

const getTestSuites = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const testSuites = await testSuiteFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(testSuites);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestSuite = async (req, res, next) => {
  try {
    const testSuiteId = req.params.testSuiteId;

    const testSuite = await testSuiteFactory.getById(testSuiteId);

    return res.status(200).json(testSuite);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addTestSuite = async (req, res, next) => {
  try {
    //Write a code to Validate testSuite data
    const testSuiteData = req.body;
    testSuiteData.status = "NEW";

    const testSuite = await testSuiteFactory.add(testSuiteData);

    return res.status(200).json(testSuite);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestSuite = async (req, res, next) => {
  try {
    const testSuiteId = req.params.testSuiteId;
    const testSuiteData = req.body;

    const testSuite = await testSuiteFactory.update(testSuiteId, testSuiteData);

    return res.status(200).json(testSuite);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteTestSuite = async (req, res, next) => {
  try {
    const testSuiteId = req.params.testSuiteId;

    const testSuite = await testSuiteFactory.remove(testSuiteId);

    return res.status(200).json(testSuite);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getTestSuites,
  getTestSuite,
  addTestSuite,
  updateTestSuite,
  deleteTestSuite,
};
