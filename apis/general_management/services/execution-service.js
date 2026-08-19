"use strict";

const dayjs = require("dayjs");

const config = require("../config");
const helpers = require("../helpers");

const mqProducer = require("../messaging/" + config.mq_type + "/mq-producer");

const orchestrationFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-factory");
const orchestrationTestCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-test-case-factory");
const orchestrationExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/orchestration-execution-factory");
const testSourceFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-source-factory");
const testCaseFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-factory");
const testScriptFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-factory");
const testCaseExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-case-execution-factory");
const testScriptExecutionFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-script-execution-factory");
const testAgentFactory = require("../database/" +
  config.db_type_primary +
  "/factories/test-agent-factory");

const projectService = require("./project-service");
const { or } = require("sequelize");
const { notifyUserFromPrincipal } = require("./async-user-notify");

function auditPrincipal(p) {
  if (p === undefined || p === null) return "system";
  const s = String(p).trim();
  return s || "system";
}

function principalFromExecutionRow(row) {
  if (!row) return null;
  const v = row.created_by || row.executed_by || null;
  return v ? String(v).trim() || null : null;
}

function principalFromTcExecRow(row) {
  if (!row) return null;
  const v = row.created_by || null;
  return v ? String(v).trim() || null : null;
}

const ORCH_LISTENER_STATUS_NOTIFY_SKIP = new Set([
  "QUEUED",
  "PASSED",
  "FAILED",
  "ERROR",
]);

function orchStatusNotifyTitle(statusRaw) {
  const s = String(statusRaw || "").toUpperCase();
  if (s === "INPROGRESS" || s === "RUNNING") {
    return "Orchestration execution running";
  }
  if (s === "PAUSED") return "Orchestration execution paused";
  if (s === "ABORTED") return "Orchestration execution stopped";
  return `Orchestration execution status: ${statusRaw}`;
}

function orchOutcomeNotifyTitle(statusRaw) {
  const s = String(statusRaw || "").toUpperCase();
  if (s === "PASSED") return "Orchestration execution completed";
  if (s === "FAILED") return "Orchestration execution failed";
  if (s === "ERROR") return "Orchestration execution error";
  return `Orchestration execution finished (${statusRaw})`;
}

function notifyPrincipalSafe(principal, payload) {
  return notifyUserFromPrincipal(principal, payload).catch(() => {});
}

const formatExecutionConfig = (
  orchestration,
  testSource,
  orchestrationExecution,
  mqUserPrincipal
) => {
  const executionConfig = {
    user_id: auditPrincipal(mqUserPrincipal),
    project_id: orchestration.project_id,
    execution_type: "orchestration",
    execution_id:
      orchestrationExecution != null
        ? orchestrationExecution.orchestration_execution_id
        : "",

    //Orchestration Execution
    execution: {
      mode: orchestration.configuration.run_order,
      base: orchestration.configuration.execution_base,
      on_error_abort: orchestration.configuration.continue_on_error
        ? false
        : true,
    },
    //Orchestration Configuration
    test_fw_type: testSource.test_framework,
    test_cases_source: {
      type: testSource.source_type,
      directory_path: testSource.source_path,
      suite_name: testSource.suite_name,
      configs: {
        username: testSource.access_username,
        password: testSource.access_password,
        access_token: testSource.access_token,
        url: testSource.repository_server_url,
        branch: testSource.repository_branch_name,
        repository_type: testSource.repository_type,
      },
    },
    options: "",
  };

  return executionConfig;
};

const formatExecutionTestCases = (
  executionBase,
  orchestrationTests,
  testsToExecute
) => {
  let selectedTestCases = [];
  let testKey =
    executionBase === "TEST_SCRIPT" ? "test_script_id" : "test_case_id";
  for (let orchestrationTest of orchestrationTests) {
    selectedTestCases.push({
      file_name: testsToExecute[orchestrationTest[testKey]].file_name,
      file_path: testsToExecute[orchestrationTest[testKey]].file_path,
      test_name: testsToExecute[orchestrationTest[testKey]].name || "",
      test_script_id: testsToExecute[orchestrationTest[testKey]].test_script_id,
      test_case_id:
        testsToExecute[orchestrationTest[testKey]].test_case_id || "",
      test_case_no:
        testsToExecute[orchestrationTest[testKey]].test_case_no || "",
      depends_on: "",
    });
  }

  return selectedTestCases;
};

const formatExecutionMessage = (
  executionConfig,
  executionTestCases,
  testAgents
) => {
  let executionMessages = [];
  if (executionConfig.execution.mode === "DISTRIBUTED") {
    const agentCount = testAgents.length;
    for (let agent of testAgents) {
      let executionMessage = Object.assign({}, executionConfig);
      executionMessage.selected_test_cases = [];
      executionMessage.agent_name = agent.name;

      // Distribute test cases among agents
      const testCasesPerAgent = Math.ceil(
        executionTestCases.length / agentCount
      );
      const startIndex = testAgents.indexOf(agent) * testCasesPerAgent;
      const endIndex = startIndex + testCasesPerAgent;
      executionMessage.selected_test_cases = executionTestCases.slice(
        startIndex,
        endIndex
      );

      if (executionMessage.selected_test_cases.length > 0) {
        executionMessages.push(executionMessage);
      }
    }
  } else {
    // For non-distributed execution, use the first agent
    let executionMessage = Object.assign({}, executionConfig);
    executionMessage.selected_test_cases = executionTestCases;
    executionMessage.agent_name = testAgents[0].name; // Assuming a single agent for non-distributed execution
    executionMessages.push(executionMessage);
  }

  return executionMessages;
};

const startExecution = async (
  orchestrationId,
  testAgentNames,
  initiatedByPrincipal = null,
) => {
  try {
    const orchestration = await orchestrationFactory.getById(orchestrationId);

    // Check if test agents are provided
    if (testAgentNames.length === 0) {
      throw new Error("No test agents provided for execution");
    }
    // Fetch Test Agents
    const testAgents = await testAgentFactory.getByNames(testAgentNames);
    if (testAgents.length === 0) {
      throw new Error("No test agents available for execution");
    }

    // Fetch Test Sources
    const testSources = await testSourceFactory.getByProjectId(
      orchestration.project_id,
      false
    );
    if (!testSources) {
      throw new Error("No test sources found for the project");
    }
    const testSource = testSources[0]; // Assuming the first test source is used for execution

    // Fetch Test Cases for the Orchestration
    const orchestrationTests = await orchestrationTestCaseFactory.getByFilter(
      {
        orchestration_id: orchestrationId,
      },
      [["execution_order", "ASC"]]
    );

    if (orchestrationTests.data != null && orchestrationTests.data.length > 0) {
      let orchestrationTestIds = [];
      let testsToExecute = [];
      if (orchestration.configuration.execution_base === "TEST_SCRIPT") {
        orchestrationTestIds = orchestrationTests.data.map(
          (orchestrationTest) => {
            return orchestrationTest.test_script_id;
          }
        );
      } else {
        orchestrationTestIds = orchestrationTests.data.map(
          (orchestrationTest) => {
            return orchestrationTest.test_case_id;
          }
        );
      }
      orchestrationTestIds = [...new Set(orchestrationTestIds)];
      if (orchestration.configuration.execution_base === "TEST_SCRIPT") {
        testsToExecute = await testScriptFactory.getByIds(orchestrationTestIds);
        testsToExecute = helpers.rekey(testsToExecute, "test_script_id", true);
      } else {
        testsToExecute = await testCaseFactory.getWithTestScriptsByIds(
          orchestrationTestIds
        );
        testsToExecute = helpers.rekey(testsToExecute, "test_case_id", true);
      }

      // Create a unique orchestration execution ID
      const orchestrationExecutionId =
        orchestration.orchestration_id +
        "-" +
        dayjs().format("YYYYMMDDHHmmssSSS") +
        "000" +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      const by = auditPrincipal(initiatedByPrincipal);
      const orchestrationExecution = {
        orchestration_execution_id: orchestrationExecutionId,
        project_id: orchestration.project_id,
        orchestration_id: orchestration.orchestration_id,
        orchestration_version: orchestration.orchestration_version,
        created_by: by,
        executed_by: by,
        status: "QUEUED",
        pass_percentage: 0,
        completion_percentage: 0,
        total_tests: orchestrationTests.data.length,
        test_agents: testAgents.map((agent) => agent.name).join(","),
      };
      const createdOrchestrationExecution =
        await orchestrationExecutionFactory.add(orchestrationExecution);

      // Create the execution configuration message common for multiple test agents
      const executionConfig = formatExecutionConfig(
        orchestration,
        testSource,
        createdOrchestrationExecution,
        initiatedByPrincipal
      );
      const executionTestCases = formatExecutionTestCases(
        orchestration.configuration.execution_base,
        orchestrationTests.data,
        testsToExecute
      );
      const executionMessages = formatExecutionMessage(
        executionConfig,
        executionTestCases,
        testAgents
      );

      // Send execution messages to the message queue for each agent
      for (let executionMessage of executionMessages) {
        console.log(
          "Sending execution message to exchange - ",
          config.mq_exchanges.execution_request,
          executionMessage
        );
        mqProducer.sendToExchange(
          config.mq_exchanges.execution_request,
          "topic",
          executionMessage.agent_name + ".*",
          JSON.stringify(executionMessage)
        );
      }

      notifyPrincipalSafe(initiatedByPrincipal, {
        category: "orchestration_execution",
        title: "Orchestration execution queued",
        body: `${createdOrchestrationExecution.orchestration_execution_id} was queued (${orchestrationTests.data.length} test case(s)). Agents: ${testAgents.map((a) => a.name).join(", ")}.`,
        referenceType: "orchestration_execution",
        referenceId: createdOrchestrationExecution.orchestration_execution_id,
        createdBy: by,
      });

      return createdOrchestrationExecution;
    } else {
      throw new Error("No test cases found for execution");
    }
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const pauseExecution = async (orchestrationId) => {
  try {
    const orchestration = await orchestrationFactory.getById(orchestrationId);
    const orchestrationExecution =
      await orchestrationExecutionFactory.getCurrentExecution(orchestrationId);
    if (!orchestrationExecution) {
      throw new Error("No current execution found for the orchestration");
    }

    //TODO - add logic to verify executing agent is still alive
    const testAgentNames = orchestrationExecution.test_agents;

    let executionMessage = {
      command: "pause",
      orchestration_id: orchestration.orchestration_id,
    };
    for (let testAgentName of testAgentNames.split(",")) {
      mqProducer.sendToExchange(
        config.mq_exchanges.execution_control_request,
        "topic",
        testAgentName + ".command",
        JSON.stringify(executionMessage)
      );
    }

    return true;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const resumeExecution = async (orchestrationId) => {
  try {
    const orchestration = await orchestrationFactory.getById(orchestrationId);
    const orchestrationExecution =
      await orchestrationExecutionFactory.getPausedExecution(orchestrationId);
    if (!orchestrationExecution) {
      throw new Error("No paused execution found for the orchestration");
    }
    const testAgentNames = orchestrationExecution.test_agents;

    let executionMessage = {
      command: "resume",
      orchestration_id: orchestration.orchestration_id,
    };

    for (let testAgentName of testAgentNames.split(",")) {
      mqProducer.sendToExchange(
        config.mq_exchanges.execution_control_request,
        "topic",
        testAgentName + ".command",
        JSON.stringify(executionMessage)
      );
    }

    return true;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const stopExecution = async (orchestrationId) => {
  try {
    const orchestration = await orchestrationFactory.getById(orchestrationId);
    const orchestrationExecution =
      await orchestrationExecutionFactory.getCurrentExecution(orchestrationId);
    if (!orchestrationExecution) {
      throw new Error("No current execution found for the orchestration");
    }

    orchestrationExecution.status = "ABORTED";
    orchestrationExecution.save();

    orchestration.status = "ABORTED";
    orchestration.save();

    projectService.updateProjectStatus(orchestration.project_id);

    //TODO - add logic to verify executing agent is still alive
    const testAgentNames = orchestrationExecution.test_agents;

    let executionMessage = {
      command: "stop",
      orchestration_id: orchestration.orchestration_id,
    };

    for (let testAgentName of testAgentNames.split(",")) {
      mqProducer.sendToExchange(
        config.mq_exchanges.execution_control_request,
        "topic",
        testAgentName + ".command",
        JSON.stringify(executionMessage)
      );
    }

    notifyPrincipalSafe(principalFromExecutionRow(orchestrationExecution), {
      category: "orchestration_execution",
      title: "Orchestration execution stopped",
      body: `${orchestrationExecution.orchestration_execution_id}: stop was requested; status set to ABORTED.`,
      referenceType: "orchestration_execution",
      referenceId: orchestrationExecution.orchestration_execution_id,
      createdBy:
        auditPrincipal(principalFromExecutionRow(orchestrationExecution)),
    });

    return true;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const parseOrchestrationExecutionResult = async (executionResult) => {
  const orchestration = await orchestrationFactory.getById(
    executionResult.orchestration_id
  );
  let orchestrationExecution = {
    project_id: executionResult.project_id,
    orchestration_id: executionResult.orchestration_id,
    orchestration_execution_id: executionResult.orchestration_execution_id,
    start_time: executionResult.orchestration_start_time
      ? dayjs(
          executionResult.orchestration_start_time,
          "YYYY-MM-DD HH:mm:ss"
        ).toDate()
      : null,
    end_time: executionResult.orchestration_end_time
      ? dayjs(
          executionResult.orchestration_end_time,
          "YYYY-MM-DD HH:mm:ss"
        ).toDate()
      : null,
    elapsed_time: executionResult.orchestration_elapsed_time
      ? parseInt(executionResult.orchestration_elapsed_time, 10)
      : 0,
  };

  let testScriptExecutions = {};
  let testCaseExecutions = [];
  let orchestrationStatus = "PASSED";
  let testScriptsData = {};

  for (let testCaseResult of executionResult.test_execution_result_details) {
    if (testCaseResult.test_status === "FAILED") {
      orchestrationStatus = "FAILED";
    } else if (
      testCaseResult.test_status === "ERROR" &&
      orchestrationStatus !== "FAILED"
    ) {
      orchestrationStatus = "ERROR";
    }

    let testScriptId = null;
    if (testScriptsData[testCaseResult.file_path] === undefined) {
      let testScript =
        await testScriptFactory.getTestScriptByProjectIdAndTestScriptFilePath(
          executionResult.project_id,
          testCaseResult.file_path
        );
      console.log("Test Script - ", testScript);
      testScriptId = testScript.test_script_id;
      testScriptsData[testCaseResult.file_path] = testScriptId;
      testScriptExecutions[testScriptId] = {
        project_id: executionResult.project_id,
        orchestration_id: executionResult.orchestration_id,
        orchestration_execution_id: executionResult.orchestration_execution_id,
        user_id: executionResult.user_id,
        test_suite_id: testScript.test_suite_id,
        test_script_id: testScript.test_script_id,
        name: testCaseResult.file_name,
        file_path: testCaseResult.file_path,
        TestEnvironmentId: testCaseResult.environment_id,
        status: testCaseResult.test_status,
        start_time: testCaseResult.test_start_time
          ? dayjs(
              testCaseResult.test_start_time,
              "YYYY-MM-DD HH:mm:ss"
            ).toDate()
          : null,
        end_time: testCaseResult.test_end_time
          ? dayjs(testCaseResult.test_end_time, "YYYY-MM-DD HH:mm:ss").toDate()
          : null,
        elapsed_time: testCaseResult.test_elapsed_time
          ? testCaseResult.test_elapsed_time
          : 0,
        result_details: testCaseResult.test_message,
      };
    } else {
      testScriptId = testScriptsData[testCaseResult.file_path];
      if (testCaseResult.test_status === "FAILED") {
        testScriptExecutions[testScriptId]["status"] = "FAILED";
      } else if (
        testCaseResult.test_status === "ERROR" &&
        testScriptExecutions[testScriptId]["status"] !== "FAILED"
      ) {
        testScriptExecutions[testScriptId]["status"] = "ERROR";
      }
      let testStartTime = dayjs(
        testCaseResult.test_start_time,
        "YYYY-MM-DD HH:mm:ss"
      ).toDate();
      if (testScriptExecutions[testScriptId]["start_time"] > testStartTime) {
        testScriptExecutions[testScriptId]["start_time"] = testStartTime;
      }
      let testEndTime = dayjs(
        testCaseResult.test_end_time,
        "YYYY-MM-DD HH:mm:ss"
      ).toDate();
      if (testScriptExecutions[testScriptId]["end_time"] > testEndTime) {
        testScriptExecutions[testScriptId]["end_time"] = testEndTime;
      }
    }

    testCaseExecutions.push({
      project_id: executionResult.project_id,
      orchestration_id: executionResult.orchestration_id,
      orchestration_execution_id: executionResult.orchestration_execution_id,
      user_id: executionResult.user_id,
      test_suite_id: testScriptExecutions[testScriptId]["test_suite_id"],
      test_script_id: testScriptExecutions[testScriptId]["test_script_id"],
      test_case_name: testCaseResult.test_name,
      TestEnvironmentId: testCaseResult.environment_id,
      status: testCaseResult.test_status,
      start_time: testCaseResult.test_start_time
        ? dayjs(testCaseResult.test_start_time, "YYYY-MM-DD HH:mm:ss").toDate()
        : null,
      end_time: testCaseResult.test_end_time
        ? dayjs(testCaseResult.test_end_time, "YYYY-MM-DD HH:mm:ss").toDate()
        : null,
      elapsed_time: testCaseResult.test_elapsed_time
        ? testCaseResult.test_elapsed_time
        : 0,
      result_details: testCaseResult.test_message,
    });
  }
  orchestrationExecution.status = orchestrationStatus;
  orchestrationExecution.TestCaseExecutions = testCaseExecutions;
  orchestrationExecution.TestScriptExecutions = testScriptExecutions;

  return orchestrationExecution;
};

const updateOrchestrationExecutionResult = async (executionResult) => {
  try {
    const orchestrationExecution = await parseOrchestrationExecutionResult(
      executionResult
    );
    console.log("Orchestration Execution - ", orchestrationExecution);

    const testCaseExecutions = orchestrationExecution.TestCaseExecutions;
    const testScriptExecutions = orchestrationExecution.TestScriptExecutions;
    delete orchestrationExecution.TestCaseExecutions;
    delete orchestrationExecution.TestScriptExecutions;

    const updatedOrchestrationExecution =
      await orchestrationExecutionFactory.update(
        orchestrationExecution.orchestration_execution_id,
        orchestrationExecution
      );
    console.log(
      "Orchestration Execution Created- ",
      updatedOrchestrationExecution
    );

    if (updatedOrchestrationExecution) {
      for (const [key, testScriptExecution] of Object.entries(
        testScriptExecutions
      )) {
        console.log("Test Script Execution - ", testScriptExecution);
        const updatedScriptExecution =
          await testScriptExecutionFactory.addOrUpdateByFilter(
            {
              orchestration_execution_id:
                testScriptExecution.orchestration_execution_id,
              test_script_id: testScriptExecution.test_script_id,
            },
            testScriptExecution
          );
      }
      for (let testCaseExecution of testCaseExecutions) {
        const updatedCaseExecution =
          await testCaseExecutionFactory.addOrUpdateByFilter(
            {
              orchestration_execution_id:
                testCaseExecution.orchestration_execution_id,
              test_script_id: testCaseExecution.test_script_id,
              test_case_name: testCaseExecution.test_case_name,
            },
            testCaseExecution
          );
      }
    }
    const updatedOrchestration = await orchestrationFactory.update(
      orchestrationExecution.orchestration_id,
      {
        status: orchestrationExecution.status,
        last_executed: orchestrationExecution.end_time,
      }
    );
    const updatedProject = await projectService.updateProjectStatus(
      orchestrationExecution.project_id
    );

    const oeRow = await orchestrationExecutionFactory.getById(
      orchestrationExecution.orchestration_execution_id,
    );
    const notifyTarget =
      principalFromExecutionRow(oeRow || null) ||
      (executionResult.user_id
        ? String(executionResult.user_id).trim()
        : null);

    notifyPrincipalSafe(notifyTarget, {
      category: "orchestration_execution",
      title: orchOutcomeNotifyTitle(orchestrationExecution.status),
      body: `${orchestrationExecution.orchestration_execution_id} ended with outcome ${orchestrationExecution.status}.`,
      referenceType: "orchestration_execution",
      referenceId: orchestrationExecution.orchestration_execution_id,
      createdBy: auditPrincipal(notifyTarget),
    });

    return updatedOrchestrationExecution;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const updateExecutionStatus = async (executionResult) => {
  try {
    if (executionResult.execution_type == "orchestration") {
      const orchestrationExecutionId = executionResult.execution_id;
      const orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestrationExecutionId
      );
      if (!orchestrationExecution) {
        throw new Error("Orchestration Execution not found");
      }

      const prevStatus = orchestrationExecution.status;
      let executionData = {};
      if (!orchestrationExecution || orchestrationExecution.start_time == null) {
        executionData.start_time = dayjs().format("YYYY-MM-DD HH:mm:ss");
      }
      executionData.status = executionResult.status;
      console.log("Execution Data - ", executionData);

      const updatedOrchestrationExecution =
        await orchestrationExecutionFactory.update(
          orchestrationExecutionId,
          executionData
        );
      const updatedOrchestration = await orchestrationFactory.update(
        orchestrationExecution.orchestration_id,
        { status: executionResult.status }
      );
      const updatedProject = await projectService.updateProjectStatus(
        orchestrationExecution.project_id,
        executionResult.status
      );

      const nextStatus = executionResult.status;
      const nextUpper = nextStatus ? String(nextStatus).toUpperCase() : "";

      if (
        String(prevStatus) !== String(nextStatus) &&
        !ORCH_LISTENER_STATUS_NOTIFY_SKIP.has(nextUpper)
      ) {
        const recipient = principalFromExecutionRow(orchestrationExecution);

        notifyPrincipalSafe(recipient, {
          category: "orchestration_execution",
          title: orchStatusNotifyTitle(nextStatus),
          body: `Execution ${orchestrationExecutionId}: ${prevStatus ?? "unset"} → ${nextStatus}.`,
          referenceType: "orchestration_execution",
          referenceId: orchestrationExecutionId,
          createdBy: auditPrincipal(recipient),
        });
      }

      return updatedOrchestrationExecution;
    } else if (executionResult.execution_type == "test_case") {
      const testCaseExecutionId = executionResult.execution_id;
      const testCaseExecution = await testCaseExecutionFactory.getById(testCaseExecutionId);
      if (!testCaseExecution) {
        throw new Error("Test Script Execution not found");
      }
      const prevStatus = testCaseExecution.status;
      testCaseExecution.status = executionResult.status;
      await testCaseExecution.save();

      const nextStatus = executionResult.status;
      if (String(prevStatus) !== String(nextStatus)) {
        const recipient =
          principalFromTcExecRow(testCaseExecution) ||
          executionResult.user_id ||
          null;

        notifyPrincipalSafe(recipient, {
          category: "test_execution",
          title: "Test execution status updated",
          body: `${testCaseExecutionId}: ${prevStatus ?? "unset"} → ${nextStatus}.`,
          referenceType: "test_case_execution",
          referenceId: testCaseExecutionId,
          createdBy: auditPrincipal(recipient),
        });
      }

      return testCaseExecution;
    } 
    
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const parseTestExecutionResult = async (executionResult) => {
  try {
    let testCaseDetails = null;
    if (
      executionResult.test_case_id != undefined &&
      executionResult.test_case_id != null &&
      executionResult.test_case_id != undefined
    ) {
      testCaseDetails = await testCaseFactory.getByProjectIdAndTestCaseNo(
        executionResult.project_id,
        executionResult.test_case_id
      );
    }
    let orchestrationId = null;
    const isOrchPayload = executionResult.execution_type === "orchestration";
    let orchestrationExecutionId =
      isOrchPayload
        ? executionResult.orchestration_execution_id ||
          executionResult.execution_id ||
          null
        : executionResult.execution_id ||
          executionResult.orchestration_execution_id ||
          null;
    if (orchestrationExecutionId) {
      let orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestrationExecutionId
      );
      orchestrationId = orchestrationExecution
        ? orchestrationExecution.orchestration_id
        : null;
    }
    const mqUserAudit = auditPrincipal(executionResult.user_id);
    let testCaseExecution = {
      project_id: executionResult.project_id,
      orchestration_id: orchestrationId,
      orchestration_execution_id: orchestrationExecutionId,
      test_case_id: testCaseDetails ? testCaseDetails.test_case_id : null,
      test_script_id: testCaseDetails ? testCaseDetails.test_script_id : null,
      test_suite_id: testCaseDetails ? testCaseDetails.test_suite_id : null,
      test_case_no: executionResult.test_case_id,
      test_case_name: executionResult.test_case_name,
      status: executionResult.test_case_status,
      start_time: executionResult.test_start_time
        ? dayjs(executionResult.test_start_time, "YYYY-MM-DD HH:mm:ss").toDate()
        : null,
      end_time: executionResult.test_end_time
        ? dayjs(executionResult.test_end_time, "YYYY-MM-DD HH:mm:ss").toDate()
        : null,
      elapsed_time: executionResult.test_elapsed_time
        ? executionResult.test_elapsed_time
        : 0,
      test_agent_name: executionResult.agent_name,
      created_by: mqUserAudit,
      modified_by: mqUserAudit,
    };

    return testCaseExecution;
  } catch (error) {
    throw error;
  }
};

const extractExecutionSummary = (testCaseExecutions) => {
  let summary = {
    total: testCaseExecutions.length,
    passed: 0,
    failed: 0,
    error: 0,
    aborted: 0,
  };

  for (let execution of testCaseExecutions) {
    if (execution.status === "PASSED") {
      summary.passed++;
    } else if (execution.status === "FAILED") {
      summary.failed++;
    } else if (execution.status === "ERROR") {
      summary.error++;
    } else if (execution.status === "ABORTED") {
      summary.aborted++;
    }
  }

  return summary;
};

const updateTestCaseExecutionResult = async (executionResult) => {
  try {
    console.log("Test Execution Result recevied- ", executionResult);

    let orchestrationExecutionId = null;
    if (executionResult.execution_type === "orchestration") {
      orchestrationExecutionId =
        executionResult.orchestration_execution_id ||
        executionResult.execution_id ||
        null;
    } else {
      orchestrationExecutionId =
        executionResult.execution_id ||
        executionResult.orchestration_execution_id ||
        null;
    }

    let orchestrationExecution = null;
    if (
      orchestrationExecutionId &&
      executionResult.execution_type === "orchestration"
    ) {
      orchestrationExecution = await orchestrationExecutionFactory.getById(
        orchestrationExecutionId
      );
      if (!orchestrationExecution) {
        throw new Error("Orchestration Execution not found");
      }
    }

    // Parse the test execution result to get test case execution details
    const testCaseExecution = await parseTestExecutionResult(executionResult);
    let testCase = null;
    // If test_case_id is not provided, fetch it based on project_id and test_case_name
    if (testCaseExecution.test_case_id == null) {
      testCase = await testCaseFactory.getByProjectIdAndTestCaseName(
        testCaseExecution.project_id,
        testCaseExecution.test_case_name
      );
      testCaseExecution.test_case_id = testCase.test_case_id;
      testCaseExecution.test_script_id = testCase.test_script_id;
      testCaseExecution.test_suite_id = testCase.test_suite_id;
    }

    const prevTcRes = await testCaseExecutionFactory.getByFilter(
      {
        orchestration_execution_id: orchestrationExecutionId,
        test_case_id: testCaseExecution.test_case_id,
      },
      [],
      1,
      1
    );
    const prevStatus = prevTcRes?.data?.[0]?.status ?? null;

    // Create or update the test case execution
    const createdTestCaseExecution =
      await testCaseExecutionFactory.addOrUpdateByFilter(
        {
          orchestration_execution_id:
            testCaseExecution.orchestration_execution_id,
          test_case_id: testCaseExecution.test_case_id,
        },
        testCaseExecution
      );
    
    await testCaseFactory.update(testCaseExecution.test_case_id, {
      status: testCaseExecution.status,
    });

    const STANDALONE_TC_NOTIFY_STATUSES = new Set([
      "INPROGRESS",
      "RUNNING",
      "PASSED",
      "FAILED",
      "ERROR",
      "ABORTED",
    ]);
    const orchLinked = !!orchestrationExecution;
    const rawNew = String(testCaseExecution.status || "").toUpperCase();

    if (
      !orchLinked &&
      createdTestCaseExecution &&
      prevStatus !== testCaseExecution.status &&
      STANDALONE_TC_NOTIFY_STATUSES.has(rawNew)
    ) {
      let title = `Test execution: ${testCaseExecution.status}`;
      if (rawNew === "INPROGRESS" || rawNew === "RUNNING") {
        title = "Test execution running";
      } else if (
        rawNew === "PASSED" ||
        rawNew === "FAILED" ||
        rawNew === "ERROR" ||
        rawNew === "ABORTED"
      ) {
        title = `Test execution ${testCaseExecution.status}`;
      }

      const recipient =
        principalFromTcExecRow(prevTcRes?.data?.[0]) ||
        executionResult.user_id ||
        "system";

      notifyPrincipalSafe(recipient, {
        category: "test_execution",
        title,
        body: `${
          testCaseExecution.test_case_name || ""
        }: ${prevStatus ?? "unset"} → ${testCaseExecution.status}.`,
        referenceType: "test_case_execution",
        referenceId:
          createdTestCaseExecution.test_case_execution_id ||
          orchestrationExecutionId ||
          String(testCaseExecution.test_case_id),
        createdBy: auditPrincipal(recipient),
      });
    }

    if (orchestrationExecution) {
      // If the test case execution is complete, update orchestration execution status
      if (
        createdTestCaseExecution &&
        createdTestCaseExecution.status != "INPROGRESS"
      ) {
        const testCaseExecutions =
          await testCaseExecutionFactory.getByOrchestrationExecutionId(
            orchestrationExecution.orchestration_execution_id
          );
        const executionSummary = extractExecutionSummary(testCaseExecutions);
        console.log("Execution Summary - ", executionSummary);

        // Calculate completion percentage and update orchestration execution
        let totalTestCases = orchestrationExecution.total_tests;

        orchestrationExecution.pass_percentage =
          (executionSummary.passed / totalTestCases) * 100;
        orchestrationExecution.completion_percentage =
          ((executionSummary.passed +
            executionSummary.failed +
            executionSummary.error +
            executionSummary.aborted) /
            totalTestCases) *
          100;

        //Update Orchestration Execution status and Other Details
        if (orchestrationExecution.completion_percentage == 100) {
          if (executionSummary.failed > 0) {
            orchestrationExecution.status = "FAILED";
          } else if (executionSummary.error > 0) {
            orchestrationExecution.status = "ERROR";
          } else if (executionSummary.passed == totalTestCases) {
            orchestrationExecution.status = "PASSED";
          }
          orchestrationExecution.end_time = dayjs().format("YYYY-MM-DD HH:mm:ss");
          orchestrationExecution.elapsed_time = dayjs(
            orchestrationExecution.end_time
          ).diff(dayjs(orchestrationExecution.start_time), "seconds");

          await orchestrationFactory.update(
            orchestrationExecution.orchestration_id,
            {
              status: orchestrationExecution.status,
              last_executed: orchestrationExecution.end_time,
              last_execution_id:
                orchestrationExecution.orchestration_execution_id,
            }
          );
          await projectService.updateProjectStatus(
            orchestrationExecution.project_id,
            orchestrationExecution.status
          );
        }
        await orchestrationExecution.save();
        console.log("Orchestration Execution Updated - ", orchestrationExecution);
      }
    }

    return createdTestCaseExecution;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const getLatestOrchestrationExecution = async (orchestrationId) => {
  try {
    let filters = {
      orchestration_id: orchestrationId,
    };
    let sort = {
      orchestration_execution_id: "DESC",
    };

    const orchestrationExecutions =
      await orchestrationExecutionFactory.getByFilter(filters, sort, 1, 1);

    return orchestrationExecutions.data
      ? orchestrationExecutions.data[0]
      : null;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const getTestCaseExecutionsWithDetails = async (orchestrationExecutionId) => {
  try {
    const testCaseExecutions =
      await testCaseExecutionFactory.getByOrchestrationExecutionId(
        orchestrationExecutionId
      );
    const testCaseIds = testCaseExecutions.map((testCaseExecution) => {
      return testCaseExecution.test_case_id;
    });
    const testCases = await testCaseFactory.getWithTestScriptsByIds(
      testCaseIds
    );
    const testCasesMap = helpers.rekey(testCases, "test_case_id", true);

    let testCaseExecutionsWithDetails = [];
    for (let testCaseExecution of testCaseExecutions) {
      let testCaseExecutionsWithDetail = {};
      testCaseExecutionsWithDetail = testCaseExecution.toJSON();
      testCaseExecutionsWithDetail.test_case_name =
        testCasesMap[testCaseExecution.test_case_id].test_case_name;
      testCaseExecutionsWithDetail.test_case_no =
        testCasesMap[testCaseExecution.test_case_id].test_case_no;
      testCaseExecutionsWithDetail.name =
        testCasesMap[testCaseExecution.test_case_id].name;
      testCaseExecutionsWithDetail.file_name =
        testCasesMap[testCaseExecution.test_case_id].file_name;
      testCaseExecutionsWithDetail.file_path =
        testCasesMap[testCaseExecution.test_case_id].file_path;

      testCaseExecutionsWithDetails.push(testCaseExecutionsWithDetail);
    }

    return testCaseExecutionsWithDetails;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const getTestCaseDetailsWithExecutions = async (
  orchestrationId,
  orchestrationExecutionId
) => {
  try {
    let testCaseExecutions = null;
    let testExecutionsMap = null;
    if (orchestrationExecutionId) {
      testCaseExecutions =
        await testCaseExecutionFactory.getByOrchestrationExecutionId(
          orchestrationExecutionId
        );
      testExecutionsMap = helpers.rekey(testCaseExecutions, "test_case_id");
    }

    const orchestrationTestCases =
      await orchestrationTestCaseFactory.getByOrchestrationId(orchestrationId);
    const testCaseIds = orchestrationTestCases.map((orchestrationTestCase) => {
      return orchestrationTestCase.test_case_id;
    });
    const testCases = await testCaseFactory.getWithTestScriptsByIds(
      testCaseIds
    );
    const testCasesMap = helpers.rekey(testCases, "test_case_id", true);
    let testCasesWithExecution = [];

    for (let orchestrationTestCase of orchestrationTestCases) {
      let testCaseWithExecution = {};
      let orchestrationTestCaseData = orchestrationTestCase.dataValues;
      let testCaseData = testCasesMap[orchestrationTestCase["test_case_id"]];
      testCaseWithExecution = Object.assign(
        orchestrationTestCaseData,
        testCaseData
      );
      if (testExecutionsMap) {
        let testCaseExecutionData =
          testExecutionsMap[orchestrationTestCase.test_case_id];
        if (testCaseExecutionData && testCaseExecutionData.length > 0) {
          let testCaseExecutionDataMap = helpers.rekey(
            testCaseExecutionData,
            "test_agent_name",
            true
          );
          testCaseWithExecution = Object.assign(
            testCaseWithExecution,
            testCaseExecutionDataMap.dataValues
          );
        }
      }
      testCasesWithExecution.push(testCaseWithExecution);
    }

    return testCasesWithExecution;
  } catch (error) {
    console.log(error);

    return error.message;
  }
};

const startTestCaseExecution = async (
  testCaseId,
  agentName,
  initiatedByPrincipal = null
) => {
  try {
    const testCase = await testCaseFactory.getById(testCaseId);
    if (!testCase) {
      throw new Error("Test case not found");
    }

    const testAgents = await testAgentFactory.getByNames([agentName]);
    if (!testAgents || testAgents.length === 0) {
      throw new Error("Test agent not found");
    }

    const testSources = await testSourceFactory.getByProjectId(
      testCase.project_id,
      false
    );
    if (!testSources || testSources.length === 0) {
      throw new Error("No test source found for the project");
    }
    const testSource = testSources[0];

    const testScript = await testScriptFactory.getById(testCase.test_script_id);

    const executionId =
      testCase.test_case_id +
      "-" +
      dayjs().format("YYYYMMDDHHmmssSSS") +
      "000" +
      "-" +
      Math.floor(1000 + Math.random() * 9000);

    const executionMessage = {
      user_id: auditPrincipal(initiatedByPrincipal),
      project_id: testCase.project_id,
      execution_id: executionId,
      execution_type: "test_script",
      execution: {
        mode: "SEQUENTIAL",
        base: "TEST_SCRIPT",
        on_error_abort: "false",
      },
      test_fw_type: testSource.test_framework,
      test_cases_source: {
        type: testSource.source_type,
        directory_path: testSource.source_path,
        suite_name: testSource.suite_name,
        configs: {
          username: testSource.access_username,
          password: testSource.access_password,
          access_token: testSource.access_token,
          url: testSource.repository_server_url,
          branch: testSource.repository_branch_name,
          repository_type: testSource.repository_type,
        },
      },
      options: "",
      selected_test_cases: [
        {
          file_name: testScript ? testScript.file_name : "",
          file_path: testScript ? testScript.file_path : "",
          test_name: testCase.name || "",
          test_script_id: testCase.test_script_id,
          test_case_id: testCase.test_case_id,
          test_case_no: testCase.test_case_no || "",
          depends_on: "null",
          automation_code: testCase.automation_code || "",
        },
      ],
      agent_name: agentName,
    };

    console.log(
      "Sending single test case execution message to exchange - ",
      config.mq_exchanges.execution_request,
      executionMessage
    );
    mqProducer.sendToExchange(
      config.mq_exchanges.execution_request,
      "topic",
      agentName + ".*",
      JSON.stringify(executionMessage)
    );

    const by = auditPrincipal(initiatedByPrincipal);
    notifyPrincipalSafe(initiatedByPrincipal, {
      category: "test_execution",
      title: "Test execution queued",
      body: `${
        testCase.test_case_no || testCase.name || "Test case"
      } was queued on agent "${agentName}" (execution id ${executionId}).`,
      referenceType: "test_case_execution",
      referenceId: executionId,
      createdBy: by,
    });

    return {
      execution_id: executionId,
      test_case_id: testCase.test_case_id,
      agent_name: agentName,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  //scheduleExecution,
  startExecution,
  startTestCaseExecution,
  pauseExecution,
  resumeExecution,
  stopExecution,
  updateOrchestrationExecutionResult,
  updateExecutionStatus,
  updateTestCaseExecutionResult,
  getLatestOrchestrationExecution,
  getTestCaseExecutionsWithDetails,
  getTestCaseDetailsWithExecutions,
};
