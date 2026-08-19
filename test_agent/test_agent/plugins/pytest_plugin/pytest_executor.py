import sys
import os

sys.path.insert(0, os.getcwd())  # nopep8
from test_agent.common.agent_base import BaseFramework


import re
import json
import pytest
import tempfile
import datetime
from contextlib import redirect_stdout
from test_agent.common.message_builder import MessageBuilder
from test_agent.plugins.pytest_plugin.pytest_listener import PytestListener
from test_agent.common.configuration_settings import ConfigurationSettings


class PytestFramework(BaseFramework):

    def make_result_directories(self):
        """
        Make directories to store results and reports
        """
        try:
            current_time = datetime.datetime.now()
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
            self.config.test_case_reports_dir = os.path.join(
                self.config.out_dir,
                "test_cases_" + str(self.config.agent_name) + timestamp,
            )
            self.config.test_script_reports_dir = os.path.join(
                self.config.out_dir,
                "test_scripts_" + str(self.config.agent_name) + timestamp,
            )
            directories = [
                self.config.out_dir,
                self.config.merge_dir,
                self.config.test_case_reports_dir,
                self.config.test_script_reports_dir,
            ]
            for directory in directories:
                if not os.path.exists(directory):
                    os.makedirs(directory)
        except Exception as e:
            self.log.logger.error(e)

    def configure(self, data):
        try:
            self.config = ConfigurationSettings()
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
            self.pytest_listener = PytestListener(
                self.msg_builder,
                self.publisher,
                self.stop_execution_event,
                self.pause_execution_event,
                self.config.on_error_abort,
            )
            self.make_result_directories()
            if data.get("options", None) is not None and data.get("options", "") != "":
                if not isinstance(data.get("options"), dict):
                    data["options"] = eval(data.get("options"))
                for option in data.get("options"):
                    if option.upper() == "ENV_VAR":
                        self.set_environment_variable(data.get("options")[option])
                    elif option.upper() == "SYS_PATH":
                        self.set_system_path(data.get("options")[option])
                    else:
                        self.log.logger.error("Invalid Option")
            return True
        except Exception as e:
            self.log.logger.error("Error while Configuring plugin: %s", e)
            return False

    def get_file_wise_tests(self, data):
        """
        Modify the test data payload to get test list file wise

        Args:
            data (list): Test list

        Returns:
            list:   File wise sorted test list. Empty in case or errors
        """
        try:
            file_wise_dict = {}
            for entry in data:
                file_name = entry.get("file_name", "")
                test_name = entry.get("test_name", "")
                self.config.received_test_list.append(
                    entry.get("file_name", "")
                    + self.config.delimeter
                    + entry.get("test_name", "")
                )
                if file_name not in file_wise_dict:
                    file_wise_dict[file_name] = {
                        "file_name": file_name,
                        "test_names": [],
                    }
                file_wise_dict[file_name]["test_names"].append(test_name)
            return list(file_wise_dict.values())
        except Exception as e:
            print(e)
            return []

    def execute_tests(self, is_test_case=True):
        """
        Execute the test cases

        Args:
            is_test_case (bool): Is the execution base TEST_CASE. (false if TEST_SCRIPT)

        Returns:
            dict: Test execution status with test status and message if any.
        """
        try:
            command_list = []
            test_list = (
                self.config.selected_test_cases
                if is_test_case
                else self.get_file_wise_tests(self.config.selected_test_cases)
            )
            suite_path = self.find_folder(
                self.config.directory_path, self.config.suite_name
            )
            if not suite_path:
                self.log.logger.error(
                    f"The Test suite {self.config.suite_name} does not exist in path {self.config.directory_path}"
                )
                return {
                    "status": "Aborted",
                    "message": f"The Test suite {self.config.suite_name} does not exist in path {self.config.directory_path}",
                }

            for test_dict in test_list:
                for subdir, dirs, files in os.walk(suite_path):
                    for filename in files:
                        if filename == test_dict.get("file_name", ""):
                            filepath = os.path.join(subdir, filename)
                            base_name = os.path.basename(filepath)
                            scriptname = os.path.splitext(base_name)[0]
                            os.chdir(subdir)
                            if is_test_case:
                                test_name = test_dict.get("test_name", "")
                                self.config.received_test_list.append(
                                    base_name + self.config.delimeter + test_name
                                )
                                html_path = os.path.join(
                                    self.config.test_case_reports_dir,
                                    test_name + ".html",
                                )
                                self.xml_path = os.path.join(
                                    self.config.test_case_reports_dir,
                                    scriptname
                                    + f"{self.config.delimeter}{test_name}"
                                    + ".xml",
                                )
                                self.json_path = os.path.join(
                                    self.config.test_case_reports_dir,
                                    scriptname
                                    + f"{self.config.delimeter}{test_name}"
                                    + ".json",
                                )
                                command_list.append("-k " + test_name)
                            else:
                                html_path = os.path.join(
                                    self.config.test_script_reports_dir,
                                    scriptname + ".html",
                                )
                                self.xml_path = os.path.join(
                                    self.config.test_script_reports_dir,
                                    scriptname + ".xml",
                                )
                                self.json_path = os.path.join(
                                    self.config.test_script_reports_dir,
                                    scriptname + ".json",
                                )

                            command_list.append(f"--html={html_path}")
                            command_list.append("--self-contained-html")
                            command_list.append("--json-report")
                            command_list.append(f"--json-report-file={self.json_path}")
                            command_list.append(f"{filename}")
                            with redirect_stdout(self.msg_builder.console_log_buffer):
                                pytest.main(command_list, [self.pytest_listener])

                            message_to_publish = (
                                self.msg_builder.build_console_log_message()
                            )
                            if message_to_publish:
                                self.publisher.publish_console_log(message_to_publish)

                            command_list = []
                            os.chdir(self.config.agent_current_working_dir)
                            if self.stop_execution_event.is_set():
                                return {
                                    "status": "Aborted",
                                    "message": "Execution Aborted by user",
                                }
            return {"status": "Completed", "message": "Execution Completed"}
        except Exception as e:
            self.log.logger.error(e)
            return {"status": "Error", "message": e}

    def read_test_result(self, json_file):
        """
        Read result from test case execution json file and parse it.

        Args:
            json_file (str):    Test case result json file path

        Returns:
            list: Test case execution result details
        """
        try:
            if self.config.delimeter not in json_file:
                return

            scriptname, testname = os.path.splitext(os.path.basename(json_file))[
                0
            ].split(self.config.delimeter)
            self.config.generated_result_list.append(
                scriptname + self.config.delimeter + testname
            )

            with open(json_file, "r") as f:
                data = json.load(f)

            scriptname_with_ext = scriptname + ".py"
            start_time = datetime.datetime.fromtimestamp(data.get("created", 0))
            formatted_start_time = start_time.strftime("%Y-%m-%d %H:%M:%S")

            end_time = (
                start_time + datetime.timedelta(seconds=data.get("duration", 0))
            ).strftime("%Y-%m-%d %H:%M:%S")
            elapsed_time_in_sec = (
                datetime.timedelta(seconds=data.get("duration", 0))
            ).total_seconds()

            message = ""
            if (
                pytest.ExitCode.INTERRUPTED
                <= data.get("exitcode", -1)
                <= pytest.ExitCode.USAGE_ERROR
            ):
                message = next(
                    (
                        collector.get("longrepr", "")
                        for collector in data.get("collectors", "")
                        if "longrepr" in collector
                    ),
                    "",
                )
                return [
                    {
                        "file_name": scriptname_with_ext,
                        "test_name": testname,
                        "test_status": "ERROR",
                        "test_message": message,
                        "test_start_time": formatted_start_time,
                        "test_end_time": end_time,
                        "test_elapsed_time": elapsed_time_in_sec,
                        "agent_name": self.config.agent_name,
                    }
                ]

            if data.get("exitcode", -1) == pytest.ExitCode.NO_TESTS_COLLECTED:
                return [
                    {
                        "file_name": scriptname_with_ext,
                        "test_name": testname,
                        "test_status": "NOT_FOUND",
                        "test_message": "",
                        "test_start_time": "",
                        "test_end_time": "",
                        "test_elapsed_time": "",
                        "agent_name": self.config.agent_name,
                    }
                ]

            test_details = []
            for test in data.get("tests", {}):
                message = ""
                # pattern = re.escape(f"{scriptname_with_ext}::{testname}") + r"(?:\[.*\])?$"
                pattern = (
                    re.escape(f"{scriptname_with_ext}::")
                    + r"(?:\w+::)?"
                    + re.escape(testname)
                    + r"(?:\[.*\])?$"
                )
                if re.match(pattern, test.get("nodeid", "")):
                    status = test.get("outcome", "").upper()

                    if (
                        "call" in test
                        and test.get("call", {}).get("outcome", "") != "passed"
                    ):
                        message += test.get("nodeid", "") + "-" + status + "\n"
                        message += test.get("call", {}).get("longrepr", "") or ""
                    else:
                        message += test.get("nodeid", "") + "-" + status + "\n"
                    test_details.append(
                        {
                            "file_name": scriptname_with_ext,
                            "test_name": testname,
                            "test_status": status,
                            "test_message": message,
                            "test_start_time": formatted_start_time,
                            "test_end_time": end_time,
                            "test_elapsed_time": elapsed_time_in_sec,
                            "agent_name": self.config.agent_name,
                        }
                    )
            return test_details
        except Exception as e:
            self.log.logger.error(e)
            return []

    def read_script_result(self, json_file):
        """
        Read result from test script execution json file and parse it.

        Args:
            json_file (str):    Test script result json file path

        Returns:
            list: Test case execution result details
        """
        try:
            test_details = []
            scriptname = os.path.splitext(os.path.basename(json_file))[0]
            scriptname_with_ext = scriptname + ".py"

            with open(json_file, "r") as f:
                data = json.load(f)
            message = ""
            for test in data.get("tests", {}):
                test_name = re.search("::([^:[]+)(?:\[|$)", test.get("nodeid")).group(1)
                status = test.get("outcome", "").upper()
                elapsed_time = 0
                message = ""
                if (
                    "call" in test
                    and test.get("call", {}).get("outcome", "") != "passed"
                ):
                    message += test.get("nodeid", "") + "-" + status + "\n"
                    message += test.get("call", {}).get("longrepr", "") or ""
                else:
                    message += test.get("nodeid", "") + "-" + status + "\n"
                test_details.append(
                    {
                        "file_name": scriptname_with_ext,
                        "test_name": test_name,
                        "test_status": status,
                        "test_message": message,
                        "test_start_time": "",
                        "test_end_time": "",
                        "test_elapsed_time": elapsed_time,
                        "agent_name": self.config.agent_name,
                    }
                )
            return test_details
        except Exception as e:
            print(e)
            return []

    def output_metrics(self):
        """
        Process the report file, parse the test result data and publish it to the front end.
        """
        try:
            json_files_list = []
            test_exec_result_details = []
            if self.config.test_execution_base == "TEST_CASE":
                for root, dirs, files in os.walk(self.config.test_case_reports_dir):
                    for file in files:
                        if file.endswith(".json"):
                            json_files_list.append(os.path.join(root, file))
                for json_file in json_files_list:
                    test_result = self.read_test_result(json_file)
                    test_exec_result_details.extend(test_result)
            else:
                for root, dirs, files in os.walk(self.config.test_script_reports_dir):
                    for file in files:
                        if file.endswith(".json"):
                            json_files_list.append(os.path.join(root, file))
                for json_file in json_files_list:
                    test_result = self.read_script_result(json_file)
                    test_exec_result_details.extend(test_result)

            merged_results = {}
            for result in test_exec_result_details:
                test_name = result["test_name"]
                if test_name not in merged_results:
                    merged_results[test_name] = {
                        "file_name": result["file_name"],
                        "test_name": test_name,
                        "test_status": result["test_status"],
                        "test_message": result["test_message"],
                        "test_start_time": result["test_start_time"],
                        "test_end_time": result["test_end_time"],
                        "test_elapsed_time": result["test_elapsed_time"],
                        "agent_name": result["agent_name"],
                    }
                else:
                    merged_results[test_name]["test_message"] += result["test_message"]

                    if result["test_status"] == "FAILED":
                        merged_results[test_name]["test_status"] = "FAILED"

            merged_results_list = list(merged_results.values())

            self.config.generated_result_list = [
                test_dict.get("file_name", "")
                + self.config.delimeter
                + test_dict.get("test_name", "")
                for test_dict in merged_results_list
            ]

            if sorted(self.config.received_test_list) != sorted(
                self.config.generated_result_list
            ):
                different_tests = set(self.config.received_test_list) ^ set(
                    self.config.generated_result_list
                )
                for test in different_tests:
                    merged_results_list.append(
                        {
                            "file_name": test.split(self.config.delimeter)[0],
                            "test_name": test.split(self.config.delimeter)[1],
                            "test_status": "NOT_FOUND",
                            "test_message": "",
                            "test_start_time": "",
                            "test_end_time": "",
                            "test_elapsed_time": "",
                            "agent_name": self.config.agent_name,
                        }
                    )

            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    merged_results_list, "COMPLETED"
                )
            )
            self.publisher.publish_execution_completed(message_to_publish)
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
        except Exception as e:
            self.log.logger.error(e)

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
            self.publisher.publish_execution_completed(message_to_publish)
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.clean_up_plugin()
        except Exception as e:
            print(e)

    def generate_and_upload_reports(self):
        """
        Upload reports and publish execution completion message
        """
        try:
            self.upload_files(self.config.test_case_reports_dir)
            self.upload_files(self.config.test_script_reports_dir)
            self.output_metrics()
            self.clean_up_plugin()

        except Exception as e:
            self.log.logger.error(e)

    def upload_files(self, folder_path):
        """
        Upload files to the frontend logger service

        Args:
            folder_path (str): Result directory path
        """
        try:
            print(f"Uploading files from directory: {folder_path}")
            extensions = [".html", ".png", ".jpg"]
            files = os.listdir(folder_path)
            filtered_files = [
                file for file in files if any(file.endswith(ext) for ext in extensions)
            ]
            for file_name in filtered_files:
                file_path = os.path.join(folder_path, file_name)
                if not self.stop_execution_event.is_set():
                    self.publisher.publish_report(
                        self.config.project_id,
                        self.config.execution_id,
                        self.config.execution_type,
                        file_path,
                    )
        except Exception as e:
            print(e)

    def run(self, data):
        try:
            print("[PytestFramework] Running tests")
            if self.configure(data):
                print("[PytestFramework] Configuration successful")
                self.log.logger.debug(json.dumps(self.config.__dict__, indent=4))
            else:
                print("[PytestFramework] Configuration failed")
                return False

            result = self.execute_tests(
                is_test_case=(self.config.test_execution_base == "TEST_CASE")
            )

            print(f"[PytestFramework] Execution Result: {result}")

            if result.get("status", "") != "Completed":
                self.log.logger.error("Execution aborted by user or due to errors")
                self.execution_aborted(result)
                return False
            return True

        except Exception as e:
            print(f"[PytestFramework] Error during run: {e}")
            return False
