"use strict";

const config = require("../../config.js");
const amqp = require("amqplib/callback_api");
const path = require("path");

const testSuiteFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/test-suite-factory");
const testScriptFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/test-script-factory");
const testCaseFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/test-case-factory");

const parseTestCase = (testData) => {
  let testCase = {
    project_id: testData.project_id,
    test_source_id: testData.test_source_id,
    name: testData.test_name,
    description: testData.test_name,
    test_case_no: testData.test_id,
    tags: testData.test_tags.join(),
  };

  return testCase;
};

const parseTestScript = (scriptData) => {
  let testScript = {
    project_id: scriptData.project_id,
    test_source_id: scriptData.test_source_id,
    name: scriptData.file_name,
    file_name: scriptData.file_name,
    file_path: scriptData.file_path,
  };

  return testScript;
};

const parseTestSuite = (suiteData) => {
  //let dirpath = path.split(suiteData.filepath).slice(0, -1).join(path.sep);
  let dirpath = path.dirname(suiteData.file_path);
  let testSuite = {
    project_id: suiteData.project_id,
    test_source_id: suiteData.test_source_id,
    name: suiteData.suite_name,
    directory_name: path.basename(dirpath),
    directory_path: dirpath,
    test_framework: suiteData.test_fw_type,
    created_by: suiteData.user_id,
    modified_by: suiteData.user_id,
  };

  return testSuite;
};

const retryConnection = (url, queue) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    listenToQueue(url, queue);
  }, 5000);
};

const listenToQueue = async (url, queue) => {
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        throw error0;
      }
      console.log("RabbitMQ connection established to - ", url);

      connection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
        }
        console.log("RabbitMQ channel created for queue - ", queue);

        channel.assertQueue(queue, { durable: true });

        channel.consume(
          queue,
          async (message) => {
            let data = JSON.parse(message.content.toString());
            let projectId =
              data != null && data[0] != undefined ? data[0].project_id : null;
            console.log(
              "Received tests repository scan response for Project - ",
              projectId
            );
            try {
              if (data != null && projectId != null) {
                for (let suiteData of data) {
                  let testSuite = parseTestSuite(suiteData);
                  //testSuite.project_id = data.projectId;
                  testSuite.organization_id = 1; // TODO: Get organization id from user
                  testSuite = await testSuiteFactory.addOrFetch(testSuite);
                  if (
                    testSuite == null ||
                    testSuite.test_suite_id == null ||
                    testSuite.test_suite_id == undefined
                  ) {
                    console.log("Error while adding test suite - ", testSuite);
                    return;
                  }

                  let testScript = parseTestScript(suiteData);
                  //testScript.project_id = data.projectId;
                  testScript.organization_id = testSuite.organization_id;
                  testScript.project_id = testSuite.project_id;
                  testScript.test_suite_id = testSuite.test_suite_id;
                  testScript.created_by = testSuite.created_by;
                  testScript.modified_by = testSuite.modified_by;
                  testScript = await testScriptFactory.addOrFetch(testScript);
                  if (
                    testScript == null ||
                    testScript.test_script_id == undefined ||
                    testScript.test_script_id == null
                  ) {
                    console.log(
                      "Error while adding test script - ",
                      testScript
                    );
                    return;
                  }

                  if (
                    suiteData.test_scenarios != undefined &&
                    suiteData.test_scenarios != null &&
                    suiteData.test_scenarios.length > 0
                  ) {
                    for (let testData of suiteData.test_scenarios) {
                      let testCase = parseTestCase(testData);
                      testCase.organization_id = testScript.organization_id;
                      testCase.project_id = testScript.project_id;
                      testCase.test_suite_id = testScript.test_suite_id;
                      testCase.test_script_id = testScript.test_script_id;
                      testCase.created_by = testScript.created_by;
                      testCase.modified_by = testScript.modified_by;
                      // TODO - bump version if there is change in version no
                      testCase = await testCaseFactory.addOrFetch(testCase);
                    }
                  }
                }
              }

              console.log("Tests parsing completed for project - ", projectId);
            } catch (error2) {
              console.log(error2);
            }
          },
          {
            noAck: true,
          }
        );
      });

      connection.on("close", function () {
        console.log("RabbitMQ Connection closed");

        retryConnection(url, queue);
      });
      connection.on("error", function (e) {
        console.log("RabbitMQ Connection closed becasue of error - ", e);

        retryConnection(url, queue);
      });
    });
  } catch (error) {
    console.log(error);

    retryConnection(url, queue);
  }
};

module.exports = {
  listenToQueue,
};
