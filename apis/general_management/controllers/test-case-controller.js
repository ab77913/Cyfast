"use strict";

const config = require("../config.js");
const helpers = require("../helpers");
const testCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-factory");

const executionService = require("../services/execution-service.js");

/**
 * @description Get all testCases
 * @param {Object} req
 * @param {Object} res
 * @returns {Object} testCases
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
 * GET /api/v1/testCases
 *
 * */

const getTestCases = async (req, res, next) => {
  try {
    const { filters, sort, include, page, size } =
      helpers.parseListFetchQuery(req.query);

    const testCases = await testCaseFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(testCases);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestCase = async (req, res, next) => {
  try {
    const testCaseId = req.params.testCaseId;

    const testCase = await testCaseFactory.getById(testCaseId);

    return res.status(200).json(testCase);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addTestCase = async (req, res, next) => {
  try {
    //Write a code to Validate testCase data
    const testCaseData = req.body;
    testCaseData.status = "NEW";

    const testCase = await testCaseFactory.add(testCaseData);

    return res.status(200).json(testCase);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestCase = async (req, res, next) => {
  try {
    const testCaseId = req.params.testCaseId;
    const testCaseData = req.body;

    const testCase = await testCaseFactory.update(testCaseId, testCaseData);

    return res.status(200).json(testCase);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteTestCase = async (req, res, next) => {
  try {
    const testCaseId = req.params.testCaseId;

    const testCase = await testCaseFactory.remove(testCaseId);

    return res.status(200).json(testCase);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const startExecution = async (req, res, next) => {
  try {
    const testCaseId = req.params.testCaseId;
    const { agent_name } = req.body;
    const initiatedBy =
      req.headers["x-user-id"] ||
      req.get?.("x-user-id") ||
      "system";

    if (!agent_name) {
      return res.status(400).json({
        message: "Agent name is required to start the execution",
      });
    }

    const result = await executionService.startTestCaseExecution(
      testCaseId,
      agent_name,
      initiatedBy
    );

    return res.status(200).json({
      message: "Execution started successfully",
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const stopExecution = async (req, res, next) => {
  try {
    const testCaseId = req.params.testCaseId;
    const { agent_name } = req.body;
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTestCases,
  getTestCase,
  addTestCase,
  updateTestCase,
  deleteTestCase,
  startExecution,
  stopExecution
};
