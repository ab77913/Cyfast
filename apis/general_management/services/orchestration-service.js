"use strict";

const config = require("../config.js");

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
const testScriptExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-execution-factory");
const testCaseExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");
const testScriptFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-factory");
const testCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-factory");

const removeOrchestrationData = async (orchestrationId) => {
  try {
    const orchestration = orchestrationFactory.getById(orchestrationId);

    if (orchestration && orchestration.status != "INPROGRESS") {
      const deletedOrchConfigs =
        orchestrationConfigurationFactory.removeByOrchestrationId(
          orchestrationId
        );
      const deletedOrchExecutions =
        orchestrationExecutionFactory.removeByOrchestrationId(orchestrationId);
      const deletedOrchTestCases =
        orchestrationTestCaseFactory.removeByOrchestrationId(orchestrationId);

      const deletedTestCaseExecutions =
        testCaseExecutionFactory.removeByOrchestrationId(orchestrationId);
      const deletedTestScriptExecutions =
        testScriptExecutionFactory.removeByOrchestrationId(orchestrationId);

      const deletedOrch = orchestrationFactory.remove(orchestrationId);
    } else {
      throw new Error(
        "Error occured! Either orchestration doesn't exist or test execution is in progress"
      );
    }
  } catch (error) {
    console.log("Error while deleting orchestration details - ", error);

    return false;
  }
};

const updateTestCases = async (orchestration, testsData) => {
  try {
    if (orchestration.status != "IN_PROGRESS") {
      // Extract Test Case IDs from the tests data
      const testCaseIds = testsData.map((testData) => testData.test_case_id);
      // Extract Unique Test Script IDs from the test cases
      const testScriptIds = [
        ...new Set(testsData.map((testData) => testData.test_script_id)),
      ];

      // Get existing orchestration test cases
      const existingTestCases =
        await orchestrationTestCaseFactory.getByOrchestrationId(
          orchestration.orchestration_id
        );

      // Remove existing test cases/scripts that are not in the new list
      // Initialize an empty array to hold mappings to remove
      let mappingsToRemove = [];
      if (existingTestCases && existingTestCases.length > 0) {
        if (orchestration.configuration.execution_base == "TEST_SCRIPT") {
          // Remove existing test scripts if they are not in the new list
          mappingsToRemove = existingTestCases.filter(
            (existingTestCase) =>
              !testScriptIds.includes(existingTestCase.test_script_id)
          );
        } else if (orchestration.configuration.execution_base == "TEST_CASE") {
          // Remove existing test cases if they are not in the new list
          mappingsToRemove = existingTestCases.filter(
            (existingTestCase) =>
              !testCaseIds.includes(existingTestCase.test_case_id)
          );
        }

        mappingsToRemove.forEach((orchestrationTestCase) => {
          orchestrationTestCaseFactory.remove(
            orchestrationTestCase.orchestration_test_case_id
          );
        });
      }

      // Add or update test cases
      const updatedTestCases = testsData.map((testData) => {
        let isExisting = false;
        // Check if test case/script already exists in records
        if (orchestration.configuration.execution_base == "TEST_SCRIPT") {
          // For TEST_SCRIPT, check by test_script_id
          isExisting = existingTestCases.find(
            (existingTestCase) =>
              existingTestCase.test_script_id === testData.test_script_id
          );
        } else if (orchestration.configuration.execution_base == "TEST_CASE") {
          // For TEST_CASE, check by test_case_id
          isExisting = existingTestCases.find(
            (existingTestCase) =>
              existingTestCase.test_case_id === testData.test_case_id
          );
        }

        if (!isExisting) {
          // Create new test case
          return orchestrationTestCaseFactory.add({
            project_id: orchestration.project_id,
            orchestration_id: orchestration.orchestration_id,
            orchestration_version: orchestration.version,
            ...testData,
          });
        }
      });

      return updatedTestCases;
    } else {
      throw new Error(
        "Error occured! Can not update while execution is in progress"
      );
    }
  } catch (error) {
    console.log("Error while updating orchestration test cases - ", error);
    return false;
  }
};

module.exports = {
  updateTestCases: updateTestCases,
  removeOrchestrationData: removeOrchestrationData,
};
