import sys
import os

sys.path.insert(0, os.getcwd())  # nopep8
from test_agent.common.agent_base import BaseFramework
from robot import run
from robot.output import librarylogger
from robot.api import ExecutionResult
import threading
import tempfile
from datetime import datetime
import json

from test_agent.common.message_builder import MessageBuilder
from test_agent.plugins.robot_plugin.robot_listener import RobotListener
from test_agent.plugins.robot_plugin.robot_test_visitor import RobotTestVisitor
from test_agent.common.configuration_settings import ConfigurationSettings


class RobotFramework(BaseFramework):

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
        """
        Configure plugin for the orchestration execution

        Args:
            data (dict): Orchestration request data from the engine

        Returns:
            bool: Is configuration successful
        """
        try:
            self.config = ConfigurationSettings()
            self.config.user_id = data["user_id"]
            self.config.project_id = data["project_id"]
 
            
            self.config.execution_id = data["execution_id"]
            self.config.execution_type = data["execution_type"]
            self.config.directory_path = data["directory_path"]
            self.config.agent_name = data["agent_name"]
            self.config.agent_id = data["agent_id"]
            self.config.agent_type = data["agent_type"]
            self.config.test_execution_base = data["execution"]["base"]
            self.config.on_error_abort = data["execution"]["on_error_abort"]
            self.config.selected_test_cases = data["selected_test_cases"]
            self.config.suite_name = data["suite_name"]
            self.config.agent_current_working_dir = os.getcwd()
            self.msg_builder = MessageBuilder(self.config)
            self.robot_listener = RobotListener(
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
                    + entry.get("test_name", "").replace(" ", "_")
                )
                if file_name not in file_wise_dict:
                    file_wise_dict[file_name] = {
                        "file_name": file_name,
                        "test_names": [],
                    }
                file_wise_dict[file_name]["test_names"].append(test_name)
            return list(file_wise_dict.values())
        except Exception as e:
            self.log.logger.error("Error %s", e)

    def execute_tests(self, is_test_case=True):
        """
        Execute the test cases

        Args:
            is_test_case (bool): Is the execution base TEST_CASE. (false if TEST_SCRIPT)

        Returns:
            dict: Test execution status with test status and message if any.
        """
        try:
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
                            if is_test_case:
                                self.config.received_test_list.append(
                                    test_dict.get("file_name", "")
                                    + self.config.delimeter
                                    + test_dict.get("test_name", "").replace(" ", "_")
                                )
                            os.chdir(subdir)
                            result_code = run(
                                filepath,
                                test=(
                                    test_dict.get("test_name", "").replace(" ", "_")
                                    if is_test_case
                                    else []
                                ),
                                debugfile=(
                                    test_dict.get("test_name", "").replace(" ", "_")
                                    if is_test_case
                                    else scriptname + "_debug"
                                ),
                                log=(
                                    test_dict.get("test_name", "").replace(" ", "_")
                                    if is_test_case
                                    else scriptname
                                ),
                                report=(
                                    test_dict.get("test_name", "").replace(" ", "_")
                                    + "_report"
                                    if is_test_case
                                    else scriptname + "_report"
                                ),
                                outputdir=(
                                    self.config.test_case_reports_dir
                                    if is_test_case
                                    else self.config.test_script_reports_dir
                                ),
                                output=(
                                    test_dict.get("test_name", "").replace(" ", "_")
                                    if is_test_case
                                    else scriptname
                                ),
                                listener=self.robot_listener,
                                variable=[],
                                stdout=self.msg_builder.console_log_buffer,
                            )
                            # result_code == 0 means all tests passed, non-zero means some failed
                            test_status = "PASS" if result_code == 0 else "FAIL"
                            if test_status == "FAIL" and self.config.on_error_abort:
                                os.chdir(self.config.agent_current_working_dir)
                                message_to_publish = self.msg_builder.build_console_log_message(
                                    "TEST EXECUTION FAILED FOR "
                                    + filename
                                    + "\nContinue on Error is set to ABORT. Aborting further execution."
                                )
                                if message_to_publish:
                                    self.publisher.publish_console_log(
                                        message_to_publish
                                    )
                                return {
                                    "status": "Aborted",
                                    "message": f"Test execution failed for {filename} with on_error_abort set to true",
                                }
                            self.log.logger.info(
                                f"Test execution result for {filepath}: {test_status}"
                            )
                            os.chdir(self.config.agent_current_working_dir)
                            if self.stop_execution_event.is_set():
                                return {
                                    "status": "Aborted",
                                    "message": "Execution Aborted by user",
                                }
            return {"status": "Completed", "message": "Execution Completed"}

        except Exception as e:
            self.log.logger.error("Error while outputting metrics: %s", e)
            return {"status": "Error", "message": e}

    def generate_and_upload_reports(self):
        """
        Upload reports and publish execution completion message
        """
        try:
            self.log.logger.info("*** [RobotFramework]  Generating execution report")
            if self.config.test_execution_base == "TEST_CASE":
                test_dict = {}
                for test in self.config.received_test_list:
                    file_name = os.path.splitext(test.split(self.config.delimeter)[0])[
                        0
                    ]
                    test_case_name = test.split(self.config.delimeter)[1]
                    xml_location = os.path.join(
                        self.config.test_case_reports_dir, f"{test_case_name}.xml"
                    )
                    if file_name not in test_dict:
                        test_dict[file_name] = ""
                    if os.path.exists(xml_location):
                        if test_dict[file_name] == "":
                            test_dict[file_name] = xml_location
                        else:
                            test_dict[file_name] += " " + xml_location
                try:
                    for test_script, test_cases_xml in test_dict.items():
                        os.system(
                            f"rebot --merge --name {test_script} --log "
                            + test_script
                            + " --report "
                            + test_script
                            + "_report --outputdir "
                            + self.config.test_script_reports_dir
                            + " --output "
                            + test_script
                            + " "
                            + test_cases_xml
                        )
                except Exception as e:
                    self.log.logger.error("Error while generating merged log: %s", e)

            try:
                main_merge_xmls = os.path.join(
                    self.config.test_script_reports_dir, "*.xml"
                )
                os.system(
                    f"rebot --name Suite --outputdir "
                    + self.config.merge_dir
                    + " --output "
                    + self.config.agent_name
                    + "_"
                    + self.config.dir_creation_timestamp
                    + "_merged "
                    + main_merge_xmls
                )
            except Exception as e:
                self.log.logger.error("Error while generating merged log: %s", e)
            self.log.logger.debug(
                "Execution log generated for Agent %s", self.config.agent_name
            )

            if self.config.test_execution_base == "TEST_CASE":
                self.upload_files(self.config.test_case_reports_dir)
            else:
                self.upload_files(self.config.test_script_reports_dir)
            self.output_metrics()
            self.clean_up_plugin()

        except Exception as e:
            self.log.logger.error("Error while generating report: %s", e)
            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    [], "REPORTING_ERROR", str(e)
                )
            )
            self.publisher.publish_execution_completed(message_to_publish)
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")

    def upload_files(self, folder_path):
        """
        Upload files to the frontend logger service

        Args:
            folder_path (str): Result directory path
        """
        try:
            self.log.logger.info("*** [RobotFramework]  Uploading reports")
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
            self.log.logger.error("Error %s", e)

    def execution_aborted(self, result):
        """
        Execution aborted. Publish message to the engine

        Args:
            result (dict): Execution status and abortion message
        """
        try:
            print("*** [RobotFramework] Execution Aborted")
            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    [],
                    result.get("status", "Aborted").upper(),
                    result.get("message", ""),
                )
            )
            self.publisher.publish_execution_completed(message_to_publish)
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.clean_up_plugin()
        except Exception as e:
            self.log.logger.error("Error %s", e)

    def output_metrics(self):
        """
        Process the report file, parse the test result data and publish it to the front end.
        """
        try:
            test_exec_result_details = []
            filepath = os.path.join(
                self.config.merge_dir,
                self.config.agent_name
                + "_"
                + self.config.dir_creation_timestamp
                + "_merged.xml",
            )
            if not os.path.exists(filepath):
                message_to_publish = (
                    self.msg_builder.build_orchestration_completion_message(
                        [], "REPORTING_ERROR", "output xml not found"
                    )
                )
                self.publisher.publish_execution_completed(message_to_publish)
                self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
                return
            result = ExecutionResult(filepath)
            test_metrics_visitor = RobotTestVisitor(test_exec_result_details)
            result.visit(test_metrics_visitor)

            self.config.generated_result_list = [
                test_dict.get("file_name", "")
                + self.config.delimeter
                + test_dict.get("test_name", "").replace(" ", "_")
                for test_dict in test_exec_result_details
            ]

            if sorted(self.config.received_test_list) != sorted(
                self.config.generated_result_list
            ):
                different_tests = set(self.config.received_test_list) ^ set(
                    self.config.generated_result_list
                )
                for test in different_tests:
                    test_exec_result_details.append(
                        {
                            "file_name": test.split(self.config.delimeter)[0],
                            "test_name": test.split(self.config.delimeter)[1],
                            "test_status": "NOT_FOUND",
                            "test_message": "",
                            "test_start_time": "",
                            "test_end_time": "",
                            "test_elapsed_time": "",
                        }
                    )

            for item in test_exec_result_details:
                item["agent_name"] = self.config.agent_name

            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    test_exec_result_details, "COMPLETED"
                )
            )
            self.publisher.publish_execution_completed(message_to_publish)
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
        except Exception as e:
            print("Error while outputting metrics: %s", e)

    def run(self, data):
        try:
            print("*** [RobotFramework] Running tests")
            librarylogger.LOGGING_THREADS += (threading.current_thread().name,)
            if self.configure(data):
                print("[RobotFramework] Configuration successful")
                self.log.logger.debug(json.dumps(self.config.__dict__, indent=4))
            else:
                print("[RobotFramework] Configuration failed")
                return False

            result = self.execute_tests(
                is_test_case=(self.config.test_execution_base == "TEST_CASE")
            )

            print(f"[RobotFramework] Test Execution Result: {result}")
            if result.get("status", "") != "Completed":
                self.log.logger.error("Execution aborted by user or due to errors")
                self.execution_aborted(result)
                return False
            return True

        except Exception as e:
            print(f"[RobotFramework] Error during run: {e}")
            return False
