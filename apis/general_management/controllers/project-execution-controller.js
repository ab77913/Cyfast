"use strict";

const config = require("../config.js");

const orchestrationExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");
const requirementExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/requirement-execution-factory");
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

const getTopFailureExecutions = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;

    const mostFailedRequirements =
      await requirementExecutionFactory.getMostFailed(projectId);
    const mostFailedTestScripts =
      await testScriptExecutionFactory.getMostFailed(projectId);
    const mostFailedTestCases = await testCaseExecutionFactory.getMostFailed(
      projectId
    );

    const executions = {
      requirement: mostFailedRequirements,
      test_script: mostFailedTestScripts,
      test_case: mostFailedTestCases,
    };

    return res.status(200).json(executions);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getRequirementExecutionStats = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;

    const executionStats = await requirementExecutionFactory.getExecutionStats(
      projectId
    );

    return res.status(200).json(executionStats);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestCaseExecutionStats = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;
    const orchestrationId = req.params.orchestrationId
      ? req.params.orchestrationId
      : null;

    const executionStats = await testCaseExecutionFactory.getExecutionStats(
      projectId,
      orchestrationId
    );

    return res.status(200).json(executionStats);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestScriptExecutionStats = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;
    const orchestrationId = req.params.orchestrationId
      ? req.params.orchestrationId
      : null;

    const executionStats = await testScriptExecutionFactory.getExecutionStats(
      projectId,
      orchestrationId
    );

    return res.status(200).json(executionStats);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getExecutionStats = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;

    const executionStats = {};
    executionStats.test_case = await testCaseExecutionFactory.getExecutionStats(
      projectId,
      null
    );
    executionStats.test_script =
      await testScriptExecutionFactory.getExecutionStats(projectId, null);

    executionStats.requirement =
      await requirementExecutionFactory.getExecutionStats(projectId);
    // if (projectId != null) {
    //   executionStats.byRequirements =
    //     await requirementExecutionFactory.getExecutionStats(projectId);
    // }

    return res.status(200).json(executionStats);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getExecutionDuration = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;

    const executionDuration =
      await orchestrationExecutionFactory.getExecutionDuration(projectId);

    return res.status(200).json(executionDuration);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getLatestExecutions = async (req, res, next) => {
  try {
    const projectId = req.params.projectId ? req.params.projectId : null;

    const latestExecutions =
      await orchestrationExecutionFactory.getLatestExecutions(projectId);

    return res.status(200).json(latestExecutions);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getExecutions,
  getExecutionStats,
  getRequirementExecutionStats,
  getTestCaseExecutionStats,
  getTestScriptExecutionStats,
  getExecutionDuration,
  getLatestExecutions,
  getTopFailureExecutions,
};
