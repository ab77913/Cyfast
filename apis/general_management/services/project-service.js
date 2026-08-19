"use strict";

const config = require("../config.js");

const mqProducer = require("../messaging/" +
  config.mq_type +
  "/mq-producer.js");
const projectFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-factory");
const projectConfigurationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/project-configuration-factory");
const orchestrationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-factory");
const orchestrationConfigurationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-configuration-factory");
const orchestrationTestCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-test-case-factory");
const orchestrationExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");
const testSuiteFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-suite-factory");
const testScriptExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-execution-factory");
const testScriptFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-factory");
const testCaseExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");
const testCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-factory");
const requirementTestCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/requirement-test-case-factory");
const requirementFactory = require("../database/" +
  config.db_type_primary +
  "/factories/requirement-factory");
const traceabilityFactory = require("../database/" +
  config.db_type_primary +
  "/factories/traceability-factory");

const getProjectSummary = async (projectId) => {
  const summary = {};
  try {
    summary.orchestrations_count = await orchestrationFactory.getCountByFilter({
      project_id: projectId,
    });
    summary.orchestrations_failed = await orchestrationFactory.getCountByFilter(
      {
        project_id: projectId,
        status: "FAILED",
      }
    );
    summary.test_cases_count = await testCaseFactory.getCountByFilter({
      project_id: projectId,
    });
    summary.test_scripts_count = await testScriptFactory.getCountByFilter({
      project_id: projectId,
    });
    summary.test_suites_count = await testSuiteFactory.getCountByFilter({
      project_id: projectId,
    });
    summary.requirements_count = await requirementFactory.getCountByFilter({
      project_id: projectId,
    });
  } catch (error) {
    console.log("Error while getting project summary - ", error);
    throw error;
  }
  return summary;
};

const updateProjectStatus = async (projectId, latestStatus = null) => {
  try {
    const project = projectFactory.getById(projectId);
    let projectStatus = project.status;

    const orchestrations = await orchestrationFactory.getByProjectId(
      projectId,
      [["last_executed", "Desc"]]
    );
    if (orchestrations.length > 0) {
      let inProgressCount = 0;
      let failedCount = 0;
      let errorCount = 0;
      let notExecutedCount = 0;
      let passedCount = 0;
      for (let i = 0; i < orchestrations.length; i++) {
        let orchestration = orchestrations[i];
        if (orchestration.status == "INPROGRESS") {
          inProgressCount++;
          break;
        } else if (orchestration.status == "FAILED") {
          failedCount++;
        } else if (orchestration.status == "ERROR") {
          errorCount++;
        } else if (orchestration.status == "NOT_EXECUTED") {
          notExecutedCount++;
        } else if (orchestration.status == "PASSED") {
          passedCount++;
        }
      }
      console.log("In Progress count - ", inProgressCount);
      console.log("Failed count - ", failedCount);
      console.log("Error count - ", errorCount);
      console.log("Not Executed count - ", notExecutedCount);
      console.log("Passed count - ", passedCount);

      if (inProgressCount > 0) {
        projectStatus = "INPROGRESS";
      } else if (failedCount > 0) {
        projectStatus = "FAILED";
      } else if (errorCount > 0) {
        projectStatus = "ERROR";
      } else if (notExecutedCount > 0) {
        projectStatus = "NOT_EXECUTED";
      } else if (passedCount == orchestrations.length) {
        projectStatus = "PASSED";
      }
    }

    if (latestStatus != null && projectStatus == project.status) {
      projectStatus = latestStatus;
    }

    const updatedProjectStatus = projectFactory.update(projectId, {
      status: projectStatus,
    });
    return updatedProjectStatus;
  } catch (error) {
    console.log("Error while sending project config update message - ", error);

    return false;
  }
};

const removeProjectData = async (projectId) => {
  try {
    const project = projectFactory.getById(projectId);

    if (project && project.status != "INPROGRESS") {
      const deletedProjectConfigs =
        projectConfigurationFactory.removeByProjectId(projectId);
      const deletedOrchConfigs =
        orchestrationConfigurationFactory.removeByProjectId(projectId);
      const deletedOrchExecutions =
        orchestrationExecutionFactory.removeByProjectId(projectId);
      const deletedOrchTestCases =
        orchestrationTestCaseFactory.removeByProjectId(projectId);
      const deletedOrchs = orchestrationFactory.removeByProjectId(projectId);
      const deletedTestCaseExecutions =
        testCaseExecutionFactory.removeByProjectId(projectId);
      const deletedTestScriptExecutions =
        testScriptExecutionFactory.removeByProjectId(projectId);
      const deletedRequirements =
        requirementFactory.removeByProjectId(projectId);
      const deletedRequirementTestCases =
        requirementTestCaseFactory.removeByProjectId(projectId);
      const deletedTestCases = testCaseFactory.removeByProjectId(projectId);
      const deletedTestScripts = testScriptFactory.removeByProjectId(projectId);
      const deletedTestSuites = testSuiteFactory.removeByProjectId(projectId);
      const deletedTraceability =
        traceabilityFactory.removeByProjectId(projectId);

      const deletedProject = projectFactory.remove(projectId);
    } else {
      throw new Error(
        "Error occured! Either project doesn't exist or test execution is in progress"
      );
    }
  } catch (error) {
    console.log("Error while deleting project details - ", error);

    return false;
  }
};

module.exports = {
  updateProjectStatus: updateProjectStatus,
  removeProjectData: removeProjectData,
  getProjectSummary: getProjectSummary,
};
