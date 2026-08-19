import sys
import os

sys.path.insert(0, os.getcwd())  # nopep8
from test_agent.common.agent_base import BaseFramework
import json
import tempfile
import subprocess
from test_agent.common.message_builder import MessageBuilder
from test_agent.common.configuration_settings import ConfigurationSettings
from test_agent.plugins.specflow_plugin.specflow_listener import SpecflowTestListener


class SpecFlowFramework(BaseFramework):

    def make_result_directories(self):
        """
        Make directories to store results and reports
        """
        try:
            self.config.out_dir = tempfile.mkdtemp(
                prefix="result_"
                + "_"
                + str(self.config.project_id)
                + "_"
                
                + str(self.config.execution_id)
            )
            self.config.test_case_reports_dir = os.path.join(
                self.config.out_dir, "test_cases_"
            )
            directories = [self.config.out_dir, self.config.test_case_reports_dir]
            for directory in directories:
                if not os.path.exists(directory):
                    os.makedirs(directory)
        except Exception as e:
            self.log.logger.error(e)

    def convert_to_dotnet_format(self, test_name):
        """
        Convert the test case name to dotnet supported string

        Args:
            test_name (str): Name of the test cae

        Returns:
            str: Dotnet formatted test case name
        """
        try:
            special_characters = "!@#$%^&*()[]{};:,<>/?`~+|"
            for char in special_characters:
                test_name = test_name.replace(char, " ")
            test_name = test_name.replace(".", "_")
            test_name = test_name.replace("-", "_")

            result = ""
            capitalize_next = True
            for char in test_name:
                if char == "_":
                    capitalize_next = True
                    result += char
                elif char == " ":
                    capitalize_next = True
                elif capitalize_next:
                    result += char.upper()
                    capitalize_next = False
                else:
                    result += char
            return result
        except Exception as e:
            print(e)
            return ""

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
            self.listener = SpecflowTestListener(
                self.msg_builder,
                self.publisher,
                self.log.logger,
                self.pause_execution_event,
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

    def execute_tests(self):
        """
        Execute the test cases

        Returns:
            dict: Test execution status with test status and message if any.
        """
        try:
            test_list = self.config.selected_test_cases
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
                            filepath = subdir + os.sep + filename
                            base_name = os.path.basename(filepath)
                            featurename = os.path.splitext(base_name)[0]
                            test_name = test_dict.get("test_name", "")
                            self.log.logger.debug("Running test: %s", featurename)
                            os.chdir(suite_path)
                            dotnet_style_test_name = self.convert_to_dotnet_format(
                                test_name
                            )
                            cmd = f"dotnet test {self.config.suite_name}.csproj --filter {dotnet_style_test_name} --results-directory {self.config.test_case_reports_dir} --logger trx;logfilename={dotnet_style_test_name}.trx --logger html;logfilename={dotnet_style_test_name}.html"
                            console_log_temp_file = tempfile.NamedTemporaryFile(
                                mode="w+b"
                            )
                            self.listener.start_of_test(test_name)
                            process = subprocess.Popen(
                                cmd,
                                stdout=console_log_temp_file,
                                stderr=subprocess.STDOUT,
                                close_fds=True,
                            )
                            while True:
                                ret = process.poll()
                                if ret is not None:
                                    temp = ""
                                    console_log_temp_file.seek(0)
                                    output = console_log_temp_file.readlines()
                                    for line in output:
                                        temp += line.decode()
                                    self.send_console_log(temp)
                                    break
                            report_path = os.path.join(
                                self.config.test_case_reports_dir,
                                dotnet_style_test_name + ".trx",
                            )
                            self.listener.end_of_test(base_name, test_name, report_path)
                            os.chdir(self.config.agent_current_working_dir)
                            if self.stop_execution_event.is_set():
                                process.kill()
                                return {
                                    "status": "Aborted",
                                    "message": "Execution Aborted by user",
                                }

            return {"status": "Completed", "message": "Execution Completed"}
        except Exception as e:
            self.log.logger.error(e)
            return {"status": "Error", "message": e}

    def send_console_log(self, message=None):
        """
        Publish console log to the front end
        """
        message_to_publish = self.msg_builder.build_console_log_message(message)
        if message_to_publish:
            self.publisher.publish_console_log(message_to_publish)

    def output_metrics(self):
        """
        Process the report file, parse the test result data and publish it to the front end.
        """
        try:
            test_exec_result_details = self.listener.get_test_execution_result_details()
            for item in test_exec_result_details:
                item["agent_name"] = self.config.agent_name

            message_to_publish = (
                self.msg_builder.build_orchestration_completion_message(
                    test_exec_result_details, "COMPLETED"
                )
            )
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.publisher.publish_execution_completed(message_to_publish)
        except Exception as e:
            self.log.logger.error(e)

    def generate_and_upload_reports(self):
        """
        Upload reports and publish execution completion message
        """
        try:
            self.upload_files(self.config.test_case_reports_dir)
            self.output_metrics()
            self.clean_up_plugin()
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
            self.log.logger.debug(f"Execution Completion Message: {message_to_publish}")
            self.publisher.publish_execution_completed(message_to_publish)
            self.clean_up_plugin()
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

    def run(self, data):
        try:
            print("[SpecFlowFramework] Running tests")
            if self.configure(data):
                print("[SpecFlowFramework] Configuration successful")
                self.log.logger.debug(json.dumps(self.config.__dict__, indent=4))
            else:
                print("[SpecFlowFramework] Configuration failed")
                return False

            result = self.execute_tests()

            print("[SpecFlowFramework] Test Execution Result:", result)
            if result.get("status", "") != "Completed":
                self.log.logger.error("Execution aborted by user or due to errors")
                self.execution_aborted(result)
                return False
            return True

        except Exception as e:
            self.log.logger.error("Error while running tests: %s", e)
            return False
