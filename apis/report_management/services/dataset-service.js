"use strict";

const config = require("../../config.js");

const projectFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/project-factory");
const orchestrationFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/orchestration-factory");
const traceabilityFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/traceability-factory");
const testCaseExecutionFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");
const orchestrationExecutionFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");

//Generate DataSet based on report variables
const getDataset = async (reportVariables, filters) => {
  let dataset = {};
  if (reportVariables && reportVariables.length > 0) {
    for (let i = 0; i < reportVariables.length; i++) {
      let reportVariableParts = reportVariables[i].split(".");
      let reportVariableKey = reportVariableParts[0];
      let reportVariableProperty =
        reportVariableParts[1] != undefined ? reportVariableParts[1] : null;
      if (dataset[reportVariableKey] === undefined) {
        let data = null;
        if (
          reportVariableKey == "project" &&
          filters.project_id != undefined &&
          filters.project_id != null &&
          filters.project_id != ""
        ) {
          data = await projectFactory.getById(filters.project_id);
        } else if (
          reportVariableKey == "project_configuration" &&
          filters.project_id !== undefined &&
          filters.project_id != null &&
          filters.project_id != ""
        ) {
          data = await projectFactory.getConfigurationsByProjectId(
            filters.project_id
          );
        } else if (
          reportVariableKey == "orchestration" &&
          filters.orchestration_id != undefined &&
          filters.orchestration_id != null &&
          filters.orchestration_id != ""
        ) {
          data = await orchestrationFactory.getById(filters.orchestration_id);
        } else if (
          reportVariableKey == "orchestration_configuration" &&
          filters.orchestration_id != undefined &&
          filters.orchestration_id != null &&
          filters.orchestration_id != ""
        ) {
          data = await orchestrationFactory.getById(filters.orchestration_id);
        } else if (
          reportVariableKey == "orchestration_execution" &&
          filters.orchestration_execution_id != undefined &&
          filters.orchestration_execution_id != null &&
          filters.orchestration_execution_id != ""
        ) {
          data = await orchestrationFactory.getExecutionById(
            filters.orchestration_execution_id
          );
        } else if (
          reportVariableKey == "execution_summary" &&
          filters.project_id != undefined &&
          filters.project_id != null &&
          filters.project_id != ""
        ) {
          data = await testCaseExecutionFactory.getExecutionSummaryByProjectId(
            filters.project_id
          );
        } else if (
          reportVariableKey == "execution_log" &&
          filters.orchestration_id != undefined &&
          filters.orchestration_id != null &&
          filters.orchestration_id != ""
        ) {
          data =
            await testCaseExecutionFactory.getExecutionLogByOrchestrationId(
              filters.orchestration_id
            );
        } else if (
          reportVariableKey == "console_log" &&
          filters.orchestration_execution_id != undefined &&
          filters.orchestration_execution_id != null &&
          filters.orchestration_execution_id != ""
        ) {
          data =
            await consoleLogService.getConsoleLogByOrchestrationExecutionId(
              filters.orchestration_execution_id
            );
        } else if (
          reportVariableKey == "requirement_coverage" &&
          filters.project_id != undefined &&
          filters.project_id != null &&
          filters.project_id != ""
        ) {
          data =
            await traceabilityFactory.getRequirementCoverageStatisticsByProjectId(
              filters.project_id
            );
        } else if (
          reportVariableKey == "risk_coverage" &&
          filters.project_id != undefined &&
          filters.project_id != null &&
          filters.project_id != ""
        ) {
          data =
            await traceabilityFactory.getRiskRequirementCoverageStatisticsByProjectId(
              filters.project_id
            );
        }

        dataset[reportVariableKey] = data;
      }
    }
  }

  return dataset;
};

const replaceTestSummaryVariables = async (htmlContent, filters) => {
  try {
    let project = await projectFactory.getById(filters.project_id);
    //console.log("Project", project);
    //docName = project.ProjectName;
    htmlContent = htmlContent.replaceAll("{{doc_type}}", "Test Summary");
    htmlContent = htmlContent.replaceAll("{{project.name}}", project.name);
    htmlContent = htmlContent.replaceAll("{{project.code}}", project.code);

    let projectParamterSettings = project.configuration || {};
    //console.log("Project Paramter Settings", projectParamterSettings);
    htmlContent = htmlContent.replaceAll(
      "{{project_configurations.app_name}}",
      projectParamterSettings.app_name ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{project_configurations.continue_on_error}}",
      projectParamterSettings.continue_on_error ? "Yes" : "No"
    );
    htmlContent = htmlContent.replaceAll(
      "{{project_configurations.phase}}",
      projectParamterSettings.phase ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{project_configurations.site_address}}",
      projectParamterSettings.SiteAddress ?? "NA"
    );

    let requirementCoverageStatistics =
      await traceabilityFactory.getRequirementCoverageStatisticsByProjectId(
        filters.project_id
      );
    //console.log("Requirement Coverage", requirementCoverageStatistics);
    htmlContent = htmlContent.replaceAll(
      "{{requirement_coverage.percentage}}",
      requirementCoverageStatistics.percentage
    );
    htmlContent = htmlContent.replaceAll(
      "{{requirement_coverage.passed}}",
      requirementCoverageStatistics.passed
    );
    htmlContent = htmlContent.replaceAll(
      "{{requirement_coverage.failed}}",
      requirementCoverageStatistics.failed
    );
    htmlContent = htmlContent.replaceAll(
      "{{requirement_coverage.not_executed}}",
      requirementCoverageStatistics.not_executed
    );

    let riskRequirementCoverageStatistics =
      await traceabilityFactory.getRiskRequirementCoverageStatisticsByProjectId(
        filters.project_id
      );
    //console.log("Risk Coverage", riskRequirementCoverageStatistics);
    htmlContent = htmlContent.replaceAll(
      "{{risk_coverage.percentage}}",
      riskRequirementCoverageStatistics.percentage
    );
    htmlContent = htmlContent.replaceAll(
      "{{risk_coverage.passed}}",
      riskRequirementCoverageStatistics.passed
    );
    htmlContent = htmlContent.replaceAll(
      "{{risk_coverage.failed}}",
      riskRequirementCoverageStatistics.failed
    );
    htmlContent = htmlContent.replaceAll(
      "{{risk_coverage.not_executed}}",
      riskRequirementCoverageStatistics.not_executed
    );

    let executionSummary =
      await testCaseExecutionFactory.getExecutionSummaryByProjectId(
        filters.project_id
      );
    //console.log("Execution Summary", executionSummary);
    let startStr = "{{#execution_summary}}";
    let endStr = "{{/execution_summary}}";
    if (htmlContent.indexOf(startStr) !== -1) {
      let pos = htmlContent.indexOf(startStr) + startStr.length;
      let subContentHtml = htmlContent.substring(
        pos,
        htmlContent.indexOf(endStr, pos)
      );
      //console.log("Sub Content", subContentHtml);
      if (
        subContentHtml &&
        subContentHtml.length > 0 &&
        executionSummary &&
        executionSummary.length > 0
      ) {
        let executionSummaryHtml = "";
        for (let i = 0; i < executionSummary.length; i++) {
          let executionSummaryItem = executionSummary[i];
          let executionSummaryItemHtml = subContentHtml;
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.orchestration_name}}",
            executionSummaryItem.name ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.execution_instance}}",
            executionSummaryItem.orchestration_execution_id ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.test_case_name}}",
            executionSummaryItem.test_case_name ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.tags}}",
            executionSummaryItem.tags ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.status}}",
            executionSummaryItem.status ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.test_start_time}}",
            executionSummaryItem.start_time ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.test_end_time}}",
            executionSummaryItem.end_time ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.release_number}}",
            executionSummaryItem.ReleaseNo ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.build_number}}",
            executionSummaryItem.BuildNo ?? "NA"
          );
          executionSummaryItemHtml = executionSummaryItemHtml.replaceAll(
            "{{execution_summary.test_environment}}",
            executionSummaryItem.TestEnvironmentId ?? "NA"
          );

          executionSummaryHtml += executionSummaryItemHtml;
          //console.log("Execution Summary Item", executionSummaryItemHtml);
        }
        htmlContent = htmlContent.replaceAll(
          startStr + subContentHtml + endStr,
          executionSummaryHtml
        );
        //console.log("Execution Summary", executionSummaryHtml);
      }
    }

    return htmlContent;
  } catch (error) {
    console.log(error);
    return "";
  }
};

const replaceOrchestrationSummaryVariables = async (htmlContent, filters) => {
  try {
    let orchestration = null;
    let orchestrationExecution = null;

    if (filters.orchestration_execution_id) {
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        filters.orchestration_execution_id
      );
      orchestration = await orchestrationFactory.getById(
        orchestrationExecution.orchestration_id
      );
    } else if (filters.orchestration_id) {
      orchestration = await orchestrationFactory.getById(
        filters.orchestration_id
      );
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestration.last_execution_id
      );
    } else {
      throw new Error(
        "Orchestration Execution ID or Orchestration ID are required"
      );
    }

    //docName = orchestration.name;
    htmlContent = htmlContent.replaceAll(
      "{{doc_type}}",
      "Orchestration Summary"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.name}}",
      orchestration.name
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.code}}",
      orchestration.code
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.version}}",
      orchestration.version ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.instance_id}}",
      filters.orchestration_execution_id ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.status}}",
      orchestrationExecution.status ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.start_time}}",
      orchestrationExecution.start_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.end_time}}",
      orchestrationExecution.end_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.elapsed_time}}",
      orchestrationExecution.elapsed_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.release_number}}",
      orchestrationExecution.release_no ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.build_number}}",
      orchestrationExecution.build_version ?? "NA"
    );

    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.is_sequential}}",
      orchestrationExecution.run_order == "Sequential" ? "checked" : ""
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.is_parallel}}",
      orchestrationExecution.run_order == "Parallel" ? "checked" : ""
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.is_distributed}}",
      orchestrationExecution.run_order == "Distributed" ? "checked" : ""
    );

    //Orchestration Configurations
    let orchestrationConfiguration = orchestration.configuration || {};
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.app_version}}",
      orchestrationConfiguration.AppVersion ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.app_path}}",
      orchestrationConfiguration.app_path ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.host}}",
      orchestrationConfiguration.driver_host ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.port}}",
      orchestrationConfiguration.driver_port ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.channel_type}}",
      orchestrationConfiguration.channel_type ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.protocol}}",
      orchestrationConfiguration.network_protocol ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_configurations.site_address}}",
      orchestrationConfiguration.site_address ?? "NA"
    );

    let testExecutionLogs =
      await testCaseExecutionFactory.getByOrchestrationExecutionId(
        orchestrationExecution.orchestration_execution_id
      );
    //console.log("Test Execution Logs", testExecutionLogs);

    let startStr = "{{#test_execution}}";
    let endStr = "{{/test_execution}}";
    if (htmlContent.indexOf(startStr) !== -1) {
      let pos = htmlContent.indexOf(startStr) + startStr.length;
      let subContentHtml = htmlContent.substring(
        pos,
        htmlContent.indexOf(endStr, pos)
      );
      //console.log("Sub Content", subContentHtml);

      let executionLogHtml = "";
      if (
        subContentHtml &&
        subContentHtml.length > 0 &&
        testExecutionLogs &&
        testExecutionLogs.length > 0
      ) {
        for (let i = 0; i < testExecutionLogs.length; i++) {
          let testExecutionLog = testExecutionLogs[i];
          let executionLogItemHtml = subContentHtml;
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.name}}",
            testExecutionLog.test_case_name ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.id}}",
            testExecutionLog.test_case_no ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.start_time}}",
            testExecutionLog.start_time ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.end_time}}",
            testExecutionLog.end_time ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.status}}",
            testExecutionLog.status ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.requirements}}",
            testExecutionLog.requirements ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.defect_id}}",
            testExecutionLog.DefectId ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.test_environment}}",
            testExecutionLog.TestEnvironmentId ?? "NA"
          );

          executionLogHtml += executionLogItemHtml;
          //console.log("Execution Log Item", executionLogItemHtml);
        }
        //console.log("Execution Log", executionLogHtml);
      }
      htmlContent = htmlContent.replaceAll(
        startStr + subContentHtml + endStr,
        executionLogHtml
      );
    }

    let executionResultStatistics =
      await testCaseExecutionFactory.getExecutionResultStatisticsByOrchestrationExecutionId(
        orchestrationExecution.orchestration_execution_id
      );
    console.log("Execution Result Statistics", executionResultStatistics);
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution_stats.total}}",
      executionResultStatistics.total_count ?? 0
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution_stats.passed}}",
      executionResultStatistics.passed_count ?? 0
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution_stats.failed}}",
      executionResultStatistics.failed_count ?? 0
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution_stats.error}}",
      executionResultStatistics.error_count ?? 0
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution_stats.not_executed}}",
      executionResultStatistics.not_executed_count ?? 0
    );

    return htmlContent;
  } catch (error) {
    console.log(error);
    return "";
  }
};

const replaceExecutionLogVariables = async (htmlContent, filters) => {
  try {
    let orchestration = null;
    let orchestrationExecution = null;

    if (filters.orchestration_execution_id) {
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        filters.orchestration_execution_id
      );
      orchestration = await orchestrationFactory.getById(
        orchestrationExecution.orchestration_id
      );
    } else if (filters.orchestration_id) {
      orchestration = await orchestrationFactory.getById(
        filters.orchestration_id
      );
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestration.last_execution_id
      );
    } else {
      throw new Error(
        "Orchestration Execution ID or Orchestration ID are required"
      );
    }
    //console.log("Execution - ", orchestrationExecution);

    //docName = orchestration.name;
    htmlContent = htmlContent.replaceAll("{{doc_type}}", "Execution Summary");
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.name}}",
      orchestration.name
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.code}}",
      orchestration.code
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.version}}",
      orchestration.version ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.instance_id}}",
      orchestrationExecution.orchestration_execution_id
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.status}}",
      orchestrationExecution.status ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.start_time}}",
      orchestrationExecution.start_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.end_time}}",
      orchestrationExecution.end_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.elapsed_time}}",
      orchestrationExecution.elapsed_time ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.release_number}}",
      orchestrationExecution.release_no ?? "NA"
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.build_number}}",
      orchestrationExecution.build_version ?? "NA"
    );

    let testExecutionLogs =
      await testCaseExecutionFactory.getByOrchestrationExecutionId(
        orchestrationExecution.orchestration_execution_id
      );

    let startStr = "{{#test_execution}}";
    let endStr = "{{/test_execution}}";
    if (htmlContent.indexOf(startStr) !== -1) {
      let pos = htmlContent.indexOf(startStr) + startStr.length;
      let subContentHtml = htmlContent.substring(
        pos,
        htmlContent.indexOf(endStr, pos)
      );
      //console.log("Sub Content", subContentHtml);

      let executionLogHtml = "";
      if (
        subContentHtml &&
        subContentHtml.length > 0 &&
        testExecutionLogs &&
        testExecutionLogs.length > 0
      ) {
        for (let i = 0; i < testExecutionLogs.length; i++) {
          let testExecutionLog = testExecutionLogs[i];
          let executionLogItemHtml = subContentHtml;
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.name}}",
            testExecutionLog.test_case_name ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.id}}",
            testExecutionLog.test_case_no ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.version}}",
            testExecutionLog.test_case_version ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{testcase.tags}}",
            testExecutionLog.tags ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.start_time}}",
            testExecutionLog.start_time ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.end_time}}",
            testExecutionLog.end_time ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.elapsed_time}}",
            testExecutionLog.elapsed_time ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.status}}",
            testExecutionLog.status ?? "NA"
          );
          executionLogItemHtml = executionLogItemHtml.replaceAll(
            "{{test_execution.test_steps}}",
            testExecutionLog.build_version ?? "NA"
          );

          executionLogHtml += executionLogItemHtml;
        }
      }

      htmlContent = htmlContent.replaceAll(
        startStr + subContentHtml + endStr,
        executionLogHtml
      );
    }

    return htmlContent;
  } catch (error) {
    console.log(error);
    return "";
  }
};

const replaceConsoleLogVariables = async (htmlContent, filters) => {
  try {
    let orchestration = null;
    let orchestrationExecution = null;

    if (filters.orchestration_execution_id) {
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        filters.orchestration_execution_id
      );
      orchestration = await orchestrationFactory.getById(
        orchestrationExecution.orchestration_id
      );
    } else if (filters.orchestration_id) {
      orchestration = await orchestrationFactory.getById(
        filters.orchestration_id
      );
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestration.last_execution_id
      );
    } else {
      throw new Error(
        "Orchestration Execution ID or Orchestration ID are required"
      );
    }

    //console.log("Orchestration", orchestration);
    //docName = orchestration.name;
    htmlContent = htmlContent.replaceAll("{{doc_type}}", "Console Log");
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.name}}",
      orchestration.name
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.code}}",
      orchestration.code
    );
    htmlContent = htmlContent.replaceAll(
      "{{orchestration.version}}",
      orchestration.version ?? "NA"
    );

    htmlContent = htmlContent.replaceAll(
      "{{orchestration_execution.instance_id}}",
      orchestrationExecution.orchestration_execution_id ?? "NA"
    );

    let consoleLog =
      await consoleLogService.getConsoleLogByOrchestrationExecutionId(
        orchestrationExecution.orchestration_execution_id
      );
    //console.log("Console Log", consoleLog);
    htmlContent = htmlContent.replaceAll("{{console_log}}", consoleLog ?? "NA");

    return htmlContent;
  } catch (error) {
    console.log(error);
    return "";
  }
};

module.exports = {
  getDataset,
  replaceTestSummaryVariables,
  replaceOrchestrationSummaryVariables,
  replaceExecutionLogVariables,
  replaceConsoleLogVariables,
};
