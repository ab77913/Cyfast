"use strict";

const config = require("../config.js");
const dashboardFactory = require("../database/" +
  config.db_type_primary +
  "/factories/dashboard-factory");
const projectFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-factory");
const testCaseExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");

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

const getKpis = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const testsInProgress = await testCaseExecutionFactory.getInProgressCount();
    const frequentFailures =
      await testCaseExecutionFactory.getFrequestFailuresCount();
    const totalProjects = await projectFactory.getCountByFilter({
      organization_id: 1,
    });
    const newlyAddedProjects = await projectFactory.getRecentlyAddedCount({
      organization_id: 1,
    });

    const kpis = {
      testsInProgress: testsInProgress,
      frequentFailures: frequentFailures,
      totalProjects: totalProjects,
      newlyAdded: newlyAddedProjects,
    };

    return res.status(200).json(kpis);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getDetails = async (req, res, next) => {
  try {
    const organizationId = 1;
    const statDetails = await dashboardFactory.getStatDetails(organizationId);

    return res.status(200).json(statDetails);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getKpis,
  getDetails,
};
