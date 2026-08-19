"use strict";

const config = require("../config.js");
const orchestrationExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");
const testCaseExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");
const testScriptExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-execution-factory");

/**
 * @description Get all orchestration executions
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

const getExecutions = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const executions = await orchestrationExecutionFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(executions);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getExecutionStats = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId
      ? req.params.orchestrationId
      : null;

    const executionStats = {};
    executionStats.test_case = await testCaseExecutionFactory.getExecutionStats(
      null,
      orchestrationId
    );
    executionStats.test_script =
      await testScriptExecutionFactory.getExecutionStats(null, orchestrationId);

    return res.status(200).json(executionStats);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getExecutionTrends = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId
      ? req.params.orchestrationId
      : null;
    const fromDate =
      req.query.fromDate != "undefined" &&
      req.query.fromDate != "" &&
      req.query.fromDate != "null"
        ? req.query.fromDate
        : null;

    const executionTrends =
      await testCaseExecutionFactory.getExecutionTrendByOrchestrationId(
        orchestrationId,
        fromDate
      );

    return res.status(200).json(executionTrends);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getExecutions,
  getExecutionStats,
  getExecutionTrends,
};
