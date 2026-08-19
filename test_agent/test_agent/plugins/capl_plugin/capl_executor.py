import sys
import os
import platform

if platform.system() != "Windows":
    raise EnvironmentError("CAPL agent is only supported on Windows OS.")


sys.path.insert(0, os.getcwd())  # nopep8
from test_agent.common.agent_base import BaseFramework
import json
from enum import Enum
from datetime import datetime
import xml.etree.cElementTree as ET
from contextlib import redirect_stdout
from test_agent.common.message_builder import MessageBuilder
from test_agent.plugins.capl_plugin.CanoeSync import CanoeSync
from test_agent.common.configuration_settings import ConfigurationSettings
import tempfile


class ResultEnum(Enum):
    """
    Enum representing result values of test execution.

    Args:
        PASSED (int): Represents the passed status.
        FAILED (int): Represents the failed status.
    """

    PASSED = 1
    FAILED = 2


class CAPLConfigurationSettings(ConfigurationSettings):
    """
    CAPLConfigurationSettings is a class that inherits from ConfigurationSettings and
    is used to store and manage settings specific to CAPL (CANoe Application Programming Language) configurations.

    Attributes:
        tse_file (str or None): The path to the TSE file. Initially set to None.
        cfg_file (str or None): The path to the CFG file. Initially set to None.
        test_case_to_test_module_mapping (dict): A dictionary mapping test cases to their corresponding test modules.
        test_script_list (list): A list to store test script names or paths.
    """

    def __init__(self) -> None:
        super().__init__()
        self.tse_file = None
        self.cfg_file = None
        self.test_case_to_test_module_mapping = {}
        self.test_script_list = []


class CanoeCyfast(CanoeSync):
    """
    CanoeCyfast is a class that inherits from CanoeSync
    It is used incorporate additional functionalities to control the CAPL test execution and report generation

    Args:
        config (CAPLConfigurationSettings): CAPLConfigurationSettings object instance
        logger (LoggerService.logger):  Logger to log messages
        msg_builder (MessageBuilder): Message builder to build message payload
        publisher (Publisher):  Publisher to publish messages
    """

    def __init__(self, config, logger, msg_builder, publisher):
        super().__init__()
        self.config = config
        self.msg_builder = msg_builder
        self.logger = logger
        self.publisher = publisher

    def run_capl_tests(self, test_list):
        """
        It Executes the CAPL tests using the test module name.

        Args:
            test_list (list): List of test modules.
        """
        try:
            module_exec_status = ""
            for test_module in self.TestModules:
                self.send_console_log()
                if test_module.Name in test_list:
                    test_case_name = self.config.test_case_to_test_module_mapping.get(
                        test_module.Name, ""
                    )
                    message_to_publish = self.msg_builder.build_test_status_message(
                        test_case_name, "", "INPROGRESS"
                    )
                    self.publisher.publish_test_status(message_to_publish)
                    test_module.Start()
                    module_verdict = test_module.tm.Verdict
                    if module_verdict == ResultEnum.PASSED.value:
                        module_exec_status = ResultEnum.PASSED.name
                    elif module_verdict == ResultEnum.FAILED.value:
                        module_exec_status = ResultEnum.FAILED.name
                    else:
                        module_exec_status = "INPROGRESS"
                    message_to_publish = self.msg_builder.build_test_status_message(
                        test_case_name, "", module_exec_status
                    )
                    self.publisher.publish_test_status(message_to_publish)
                    self.send_console_log()
        except Exception as e:
            self.logger.error(e)

    def configure_report(self, test_module_list, report_path):
        """
        Configuration for generation of report.

        Args:
            test_module_list (list): List of executed test modules
            report_path (str): Report generation path
        """
        try:
            for test_module in self.TestModules:
                report = test_module.tm.Report
                if test_module.Name in test_module_list:
                    report_name = self.config.test_case_to_test_module_mapping.get(
                        test_module.Name, ""
                    ).split(".")[0]
                    report.FullName = os.path.join(
                        report_path, "{}.xml".format(report_name)
                    )
                    report.ReportFormat = 2
                    report.AutoNumbering = False
                    print(
                        "configured report for test module: {}".format(test_module.Name)
                    )
                else:
                    report.Enabled = False
                    print(
                        "disabled report for test module: {}".format(test_module.Name)
                    )
        except Exception as e:
            self.logger.error(e)

    def generate_report(self, result_path):
        """
        Customize and generate the test execution report

        Args:
            result_path (str): Result directory to store the report
        """
        try:
            self.send_console_log()
            self.Report = self.App.Configuration.TestSetup.TestEnvironments.Item(
                1
            ).Report
            self.Report.FullName = os.path.join(
                result_path, self.config.agent_name + "_Merged_Report.html"
            )
            self.Report.AutoNumbering = False
            self.Report.GenerateReportAsync()
        except Exception as e:
            self.logger.error(e)

    def send_console_log(self):
        """
        Build and send console log to front end
        """
        message_to_publish = self.msg_builder.build_console_log_message()
        if message_to_publish:
            self.publisher.publish_console_log(message_to_publish)


class CAPLFramework(BaseFramework):

    def configure(self, data):
        try:
            self.config = CAPLConfigurationSettings()
            self.config.user_id = data["user_id"]
            self.config.project_id = data["project_id"]
      
            self.config.execution_id = data["execution_id"]
            self.config.execution_type = data["execution_type"]
            self.config.directory_path = data["directory_path"]
            self.config.agent_name = data["agent_name"]
            self.config.agent_id = data["agent_id"]
            self.config.test_execution_base = data["execution"]["base"]
            self.config.on_error_abort = data["execution"]["on_error_abort"]
            self.config.selected_test_cases = data["selected_test_cases"]
            self.config.suite_name = data["suite_name"]
            self.config.agent_current_working_dir = os.getcwd()
            self.msg_builder = MessageBuilder(self.config)
            self.make_result_directories()

            if data.get("options", None) is not None and data.get("options", "") != "":
                if not isinstance(data.get("options"), dict):
                    data["options"] = eval(data.get("options"))
                for option in data.get("options"):
                    if option.upper() == "ENV_VAR":
                        self.set_environment_variable(data.get("options")[option])
                    elif option.upper() == "SYS_PATH":
                        self.set_system_path(data.get("options")[option])
                    elif option.upper() == "TSE_FILE":
                        self.set_tse_file(data.get("options")[option])
                    elif option.upper() == "CFG_FILE":
                        self.set_cfg_file(data.get("options")[option])
                    else:
                        self.logger.error("Invalid Option")
            if not self.config.tse_file or not self.config.cfg_file:
                print("NO TSE OR CFG GIVEN")
                return False
            return True
        except Exception as e:
            self.logger.error("Error while Configuring plugin: %s", e)
            return False

    def output_metrics(self):
        """
        Process the report file, parse the test result data and publish it to the front end.
        """
        try:
            xmlFilePath = os.path.join(
                self.config.merge_dir, self.config.agent_name + "_Merged_Report.xml"
            )
            tree = ET.ElementTree(file=xmlFilePath)
            root = tree.getroot()

            test_exec_result_details = []
            for chld in root:
                result_dict = {
                    "file_name": "",
                    "test_name": "",
                    "test_status": "",
                    "test_message": "",
                    "test_start_time": "",
                    "test_end_time": "",
                    "test_elapsed_time": "",
                }
                if chld.tag == "verdict":
                    pass
                if chld.tag == "testgroup":
                    for testgrp in chld:
                        if testgrp.tag == "xinfo":
                            for xinfo in testgrp:
                                if (
                                    xinfo.tag == "name"
                                    and xinfo.text == "Test Module File"
                                ):
                                    fileFoundFlag = 1
                                if xinfo.tag == "description" and fileFoundFlag == 1:

                                    result_dict["file_name"] = xinfo.text.split("\\")[
                                        -1
                                    ]
                                    result_dict["test_name"] = xinfo.text.split("\\")[
                                        -1
                                    ]
                        fileFoundFlag = 0
                        if testgrp.tag == "testcase":
                            result_dict["test_start_time"] = testgrp.get(
                                "starttime", ""
                            )
                            for testcase in testgrp:
                                if testcase.tag == "verdict":
                                    result_dict["test_end_time"] = testcase.get(
                                        "endtime", ""
                                    )
                                    result_dict["test_elapsed_time"] = float(
                                        testcase.get("endtimestamp", "")
                                    ) - float(testcase.get("timestamp", ""))
                                    if testcase.get("result", "") == "pass":
                                        result_dict["test_status"] = "PASS"
                                    elif testcase.get("result", "") == "fail":
                                        result_dict["test_status"] = "FAIL"
                                    else:
                                        pass
                                if testcase.tag == "teststep":
                                    if testcase.get("type", "") == "user":
                                        result_dict["test_message"] = testcase.text

                    test_exec_result_details.append(result_dict)

            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    test_exec_result_details, "COMPLETED"
                )
            )
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.publisher.publish_execution_completed(message_to_publish)

        except Exception as e:
            print(e)

    def set_cfg_file(self, cfg_file):
        """
        Set the configuration variable for cfg file path

        Args:
            cfg_file (str): cfg file path
        """
        try:
            for root, dirs, files in os.walk(self.config.directory_path):
                for file in files:
                    if file == cfg_file:
                        self.config.cfg_file = os.path.join(root, file)
        except Exception as e:
            print(e)

    def set_tse_file(self, tse_file):
        """
        Set the configuration variable for tse file path

        Args:
            tse_file (str): tse file path
        """
        try:
            for root, dirs, files in os.walk(self.config.directory_path):
                for file in files:
                    if file == tse_file:
                        self.config.tse_file = os.path.join(root, file)
        except Exception as e:
            print(e)

    def upload_files(self, folder_path):
        """
        Upload files to the frontend logger service

        Args:
            folder_path (str): Result directory path
        """
        try:
            print(f"Uploading files from directory: {folder_path}")
            extensions = [".html"]
            files = os.listdir(folder_path)
            filtered_files = [
                file for file in files if any(file.endswith(ext) for ext in extensions)
            ]
            for file_name in filtered_files:
                file_path = os.path.join(folder_path, file_name)
                self.publisher.publish_report(
                    self.config.project_id,
                    self.config.execution_id,
                    self.config.execution_type,
                    file_path,
                )
        except Exception as e:
            print(e)

    def generate_and_upload_reports(self):
        """
        Upload reports and publish execution completion message
        """
        try:
            self.upload_files(self.config.test_script_reports_dir)
            self.output_metrics()
            self.clean_up_plugin()
            pass

        except Exception as e:
            print(e)

    def make_result_directories(self):
        """
        Make directories to store results and reports
        """
        try:
            current_time = datetime.now()
            timestamp = current_time.strftime("%Y-%m-%d_%H-%M-%S")
            self.config.dir_creation_timestamp = timestamp
            self.config.out_dir = tempfile.mkdtemp(
                prefix="result_"
                + "_"
                + str(self.config.project_id)
     
                + "_"
                + str(self.config.execution_id)
            )
            self.config.merge_dir = os.path.join(self.config.out_dir, "merge_")
            self.config.test_script_reports_dir = os.path.join(
                self.config.out_dir,
                "test_scripts_" + str(self.config.agent_name) + timestamp,
            )
            directories = [
                self.config.out_dir,
                self.config.merge_dir,
                self.config.test_script_reports_dir,
            ]
            for directory in directories:
                if not os.path.exists(directory):
                    os.makedirs(directory)
        except Exception as e:
            print(e)

    def execute_tests(self):
        """
        Execute the test cases

        Returns:
            dict: Test execution status with test status and message if any.
        """
        try:
            test_list = self.config.selected_test_cases
            test_module_list = []
            with open(self.config.tse_file, "r") as myFile:
                lines = myFile.readlines()
                for test_dict in test_list:
                    for index, line in enumerate(lines):
                        if ".can" in line:
                            if line.split('"')[-2].endswith(
                                test_dict.get("file_name", "")
                            ):
                                test_module_list.append(
                                    lines[index + 6].replace("\n", "")
                                )
                                self.config.test_case_to_test_module_mapping[
                                    lines[index + 6].replace("\n", "")
                                ] = test_dict.get("file_name", "")
                                self.config.test_script_list.append(
                                    test_dict.get("file_name", "")
                                )
            canoe_obj = CanoeCyfast(
                self.config, self.logger, self.msg_builder, self.publisher
            )
            with redirect_stdout(self.msg_builder.console_log_buffer):
                try:
                    canoe_obj.Load(cfgPath=self.config.cfg_file)
                    canoe_obj.LoadTestSetup(testsetup=self.config.tse_file)
                except Exception as e:
                    canoe_obj.Stop()
                    canoe_obj.Load(cfgPath=self.config.cfg_file)
                    canoe_obj.LoadTestSetup(testsetup=self.config.tse_file)
                canoe_obj.configure_report(
                    test_module_list, self.config.test_script_reports_dir
                )
                canoe_obj.Start()
                canoe_obj.run_capl_tests(test_module_list)
                canoe_obj.Stop()
                canoe_obj.generate_report(self.config.merge_dir)

            return {"status": "Completed", "message": "Execution Completed"}
        except Exception as e:
            self.logger.error(e)
            return {"status": "Error", "message": ""}

    def execution_aborted(self, result):
        """
        Execution aborted. Publish message to the engine

        Args:
            result (dict): Execution status and abortion message
        """
        try:
            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    [], result.get("status", "").upper(), result.get("message", "")
                )
            )
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.publisher.publish_execution_completed(message_to_publish)
            self.clean_up_plugin()
        except Exception as e:
            print(e)

    def run(self, data):
        try:
            print("[CAPLFramework] Running tests")
            if self.configure(data):
                print("[CAPLFramework] Configuration successful")
                self.log.logger.debug(json.dumps(self.config.__dict__, indent=4))

            if self.config.test_execution_base == "TEST_SCRIPT":
                result = self.execute_tests()
            else:
                self.log.logger.error(
                    f"Unknown test_execution_base: {self.config.test_execution_base}"
                )
                return False

            if result.get("status", "") != "Completed":
                self.execution_aborted(result)
                return False
            return True

        except Exception as e:
            self.log.logger.error("Error while running tests: %s", e)
            return False
