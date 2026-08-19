"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const config = require("../config.js");

const projectFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-factory");
const orchestrationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-factory");
const orchestrationConfigurationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-configuration-factory");
const orchestrationExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");

const orchestrationService = require("../services/orchestration-service.js");
const executionService = require("../services/execution-service.js");

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

const getOrchestrations = async (req, res, next) => {
  try {
    const { page, size, filters, sort, include } = req.query;

    const orchestrations = await orchestrationFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );

    return res.status(200).json(orchestrations);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getOrchestration = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const orchestration = await orchestrationFactory.getById(orchestrationId);

    return res.status(200).json(orchestration);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const addOrchestration = async (req, res, next) => {
  try {
    //Write a code to Validate orchestration data
    const orchestrationData = req.body;

    const project = await projectFactory.getById(orchestrationData.project_id);
    const orchestrationConfigurationData = orchestrationData.configuration
      ? orchestrationData.configuration
      : null;
    const orchestrationTestCasesData =
      orchestrationData.test_cases && orchestrationData.test_cases.length > 0
        ? orchestrationData.test_cases
        : null;

    orchestrationData.status = "NOT_EXECUTED";
    orchestrationData.organization_id = project.organization_id;
    const orchestration = await orchestrationFactory.add(orchestrationData);

    if (orchestration) {
      // Add orchestration configuration
      if (orchestrationConfigurationData) {
        orchestrationConfigurationData.orchestration_id =
          orchestration.orchestration_id;
        orchestrationConfigurationData.project_id = orchestration.project_id;
        orchestrationConfigurationData.scheduled_start_time =
          orchestrationConfigurationData.scheduled_start_time
            ? orchestrationConfigurationData.scheduled_start_time
            : null;
        orchestrationConfigurationData.scheduled_end_time =
          orchestrationConfigurationData.scheduled_end_time
            ? orchestrationConfigurationData.scheduled_end_time
            : null;
        orchestrationConfigurationData.repeat_interval_value =
          orchestrationConfigurationData.repeat_interval_value
            ? orchestrationConfigurationData.repeat_interval_value
            : null;

        const orchestrationConfiguration =
          orchestrationConfigurationFactory.add(orchestrationConfigurationData);
        orchestration.configuration = orchestrationConfiguration;
      }
      // Add orchestration test cases
      if (orchestrationTestCasesData) {
        const orchestrationTestCases =
          await orchestrationService.updateTestCases(
            orchestration,
            orchestrationTestCasesData
          );
        orchestration.test_cases = orchestrationTestCases;
      }
    }

    return res.status(200).json(orchestration);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateOrchestration = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const orchestrationData = req.body;

    const orchestrationConfigurationData = orchestrationData.configuration
      ? orchestrationData.configuration
      : null;
    const orchestrationTestCasesData = orchestrationData.test_cases
      ? orchestrationData.test_cases
      : null;

    const orchestration = await orchestrationFactory.getById(orchestrationId);
    if (!orchestration) {
      return res.status(404).json({ message: "Orchestration not found" });
    }
    const updatedOrchestration = await orchestrationFactory.update(
      orchestrationId,
      orchestrationData
    );

    if (updatedOrchestration) {
      // Update orchestration configuration
      if (orchestrationConfigurationData) {
        orchestrationConfigurationData.orchestration_id =
          updatedOrchestration.orchestration_id;
        orchestrationConfigurationData.scheduled_start_time =
          orchestrationConfigurationData.scheduled_start_time
            ? orchestrationConfigurationData.scheduled_start_time
            : null;
        orchestrationConfigurationData.scheduled_end_time =
          orchestrationConfigurationData.scheduled_end_time
            ? orchestrationConfigurationData.scheduled_end_time
            : null;
        orchestrationConfigurationData.repeat_interval_value =
          orchestrationConfigurationData.repeat_interval_value
            ? orchestrationConfigurationData.repeat_interval_value
            : null;

        const orchestrationConfiguration =
          await orchestrationConfigurationFactory.update(
            orchestrationId,
            orchestrationConfigurationData
          );
        updatedOrchestration.configuration = orchestrationConfiguration;
      }

      // Update orchestration test cases
      if (orchestrationTestCasesData) {
        const orchestrationTestCases =
          await orchestrationService.updateTestCases(
            updatedOrchestration,
            orchestrationTestCasesData
          );
        updatedOrchestration.test_cases = orchestrationTestCases;
      } else {
        // If no test cases data is provided, remove existing test cases
        await orchestrationService.removeTestCases(orchestrationId);
      }
    }

    // if (
    //   orchestration.trigger_criteria != "PERIODICALLY" &&
    //   updatedOrchestration.trigger_criteria == "PERIODICALLY"
    // ) {
    //   await executionService.scheduleExecution(orchestrationId, "SCHEDULE");
    // } else if (
    //   orchestration.trigger_criteria == "PERIODICALLY" &&
    //   updatedOrchestration.trigger_criteria == "PERIODICALLY" &&
    //   (orchestration.scheduled_start_time !=
    //     orchestration.scheduled_start_time ||
    //     orchestration.scheduled_end_time != orchestration.scheduled_end_time ||
    //     orchestration.repeat_interval_unit !=
    //       orchestration.repeat_interval_unit ||
    //     orchestration.repeat_interval_value !=
    //       orchestration.repeat_interval_value)
    // ) {
    //   await executionService.scheduleExecution(orchestrationId, "RESCHEDULE");
    // } else if (
    //   orchestration.trigger_criteria == "PERIODICALLY" &&
    //   updatedOrchestration.trigger_criteria != "PERIODICALLY"
    // ) {
    //   await executionService.scheduleExecution(orchestrationId, "CANCEL");
    // }

    return res.status(200).json(updatedOrchestration);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const deleteOrchestration = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const orchestration = await orchestrationService.removeOrchestrationData(
      orchestrationId
    );

    return res.status(200).json(orchestration);
  } catch (error) {
    return res.status(500).json(error);
  }
};

//Orchestration Test Cases

const getTestCases = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const { filters, include } = req.query;

    const testCases = await orchestrationFactory.getTestCases(
      orchestrationId,
      filters,
      include
    );

    return res.status(200).json(testCases);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const updateTestCases = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const testCasesData = req.body;

    const orchestration = orchestrationFactory.getById(orchestrationId);
    const updatedTestCasesSummary = await orchestrationService.updateTestCases(
      orchestrationId,
      testCasesData
    );

    if (orchestration.trigger_criteria == "PERIODICALLY") {
      // if (
      //   updatedTestCasesSummary.previous == 0 &&
      //   updatedTestCasesSummary.added > 0
      // ) {
      //   await executionService.scheduleExecution(orchestrationId, "SCHEDULE");
      // } else if (
      //   (updatedTestCasesSummary.added > 0 ||
      //     updatedTestCasesSummary.deleted > 0) &&
      //   updatedTestCasesSummary.current > 0
      // ) {
      //   await executionService.scheduleExecution(
      //     orchestrationId,
      //     "CANCEL_AND_SCHEDULE"
      //   );
      // } else if (updatedTestCasesSummary.current == 0) {
      //   await executionService.scheduleExecution(orchestrationId, "CANCEL");
      // }
    }

    return res.status(200).json(updatedTestCasesSummary);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getTestCaseExecutions = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const latestOrchestrationExecution =
      await executionService.getLatestOrchestrationExecution(orchestrationId);
    const testCaseExecutionDetails =
      await executionService.getTestCaseDetailsWithExecutions(
        orchestrationId,
        latestOrchestrationExecution
          ? latestOrchestrationExecution.orchestration_execution_id
          : null
      );

    return res.status(200).json(testCaseExecutionDetails);
  } catch (error) {
    return res.status(500).json(error);
  }
};

//Orchestration Execution

const getExecutions = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const filters = {};
    filters["orchestration_id"] = orchestrationId;

    const orchestrationExecutions =
      await orchestrationExecutionFactory.getByFilter(filters);

    return res.status(200).json(orchestrationExecutions);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const getLatestExecution = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const latestOrchestrationExecution =
      await executionService.getLatestOrchestrationExecution(orchestrationId);

    return res.status(200).json(latestOrchestrationExecution);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const startExecution = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;
    const test_agent_names = req.body.test_agents;
    const initiatedBy =
      req.headers["x-user-id"] ||
      req.get?.("x-user-id") ||
      "system";

    if (!test_agent_names || test_agent_names.length === 0) {
      return res.status(400).json({
        message: "Test agents are required to start the execution",
      });
    }

    const orchestrationExecutionInstance =
      await executionService.startExecution(
        orchestrationId,
        test_agent_names,
        initiatedBy,
      );

    return res.status(200).json(orchestrationExecutionInstance);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const pauseExecution = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const orchestrationExecutionInstance =
      await executionService.pauseExecution(orchestrationId);

    return res.status(200).json(orchestrationExecutionInstance);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const resumeExecution = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const orchestrationExecutionInstance =
      await executionService.resumeExecution(orchestrationId);

    return res.status(200).json(orchestrationExecutionInstance);
  } catch (error) {
    return res.status(500).json(error);
  }
};

const stopExecution = async (req, res, next) => {
  try {
    const orchestrationId = req.params.orchestrationId;

    const orchestrationExecutionInstance = await executionService.stopExecution(
      orchestrationId
    );

    return res.status(200).json(orchestrationExecutionInstance);
  } catch (error) {
    return res.status(500).json(error);
  }
};

module.exports = {
  getOrchestrations,
  getOrchestration,
  addOrchestration,
  updateOrchestration,
  deleteOrchestration,
  getTestCases,
  updateTestCases,
  getTestCaseExecutions,
  getExecutions,
  getLatestExecution,
  startExecution,
  pauseExecution,
  resumeExecution,
  stopExecution,
};
