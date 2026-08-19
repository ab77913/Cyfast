import re
import os
import ast
from test_agent.common.parser_base import TestParserBase


class PyTestParser(TestParserBase):
    """
    A plugin for parsing PyTest tests.
    It inherits from the TestParserBase class.

    Args:
        logger (LoggerService.logger):  Logger to log messages
    """

    def __init__(self, logger):
        self.logger = logger

    def parse(self, suite_name, directory_path, project_id, user_id, test_source_id):
        """
        Searches through the directory and test suite. Parses the test cases

        Args:
            suite_name (str): Test suite folder which holds the test cases
            directory_path (str): Test root folder path
            project_id (str): Project ID
            user_id (str): User ID

        Returns:
            list: Parsed test project data. Empty in case of error or no test found

        """
        try:
            project_data = []
            suite_path = ""

            if suite_name == "":
                suite_path = directory_path
            else:
                for subdir, dirs, files in os.walk(directory_path):
                    if suite_name in dirs:
                        suite_path = os.path.join(subdir, suite_name)
                        break

            for subdir, dirs, files in os.walk(suite_path):
                for file_name in files:
                    if file_name.endswith(".py"):
                        file_path = os.path.join(subdir, file_name)
                        test_scenarios = self.get_test_scenario_details(file_path)
                        if test_scenarios:
                            file_dict = {
                                "project_id": project_id,
                                "user_id": user_id,
                                "suite_name": suite_name,
                                "file_name": file_name,
                                "file_path": file_path,
                                "test_scenarios": test_scenarios,
                                "test_fw_type": "PYTEST",
                                "test_source_id": test_source_id,
                            }
                            project_data.append(file_dict)

            return project_data
        except Exception as e:
            self.logger.error(f"Error while parsing: {e}")
            return []

    def is_pytest_bdd(self, content):
        """
        Check if the test type is BDD

        Args:
            content (str): Test file contents

        Returns:
            bool: Is the test type BDD
        """
        try:
            if "pytest_bdd" in content:
                if re.search(r"@given|@when|@then", content):
                    return True
            return False
        except Exception as e:
            self.logger.error(f"Error while checking is test bdd:  {e}")
            return False

    def get_test_case_id(self, node):
        """
        Get the test case ID from the test

        Args:
            node (ast.FunctionDef):  Line in the file content

        Returns:
            str: Test case ID. Empty string in case of errors.
        """
        try:
            for decorator_node in node.decorator_list:
                if isinstance(decorator_node, ast.Call):
                    if decorator_node.keywords:
                        keywordlist = decorator_node.keywords
                        for key in keywordlist:
                            if key.arg == "testcase_id":
                                id = key.value
                                return id.value
        except Exception as e:
            self.logger.error(f"Error while getting test case id: {e}")
            return ""

    def get_test_details(self, file_lines, file_path):
        """
        Get the test case details from the test file

        Args:
            file_lines (str): Test file content
            file_path (str): Path of the test file

        Returns:
            list: Test case details list
        """
        try:
            test_details = []
            file_content = "".join(file_lines)
            try:
                tree = ast.parse(file_content)
            except Exception as e:
                self.logger.warning(f"File {file_path} has syntax issues skipping ...")
                return []
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                    test_name = node.name

                    test_id = self.get_test_case_id(node)
                    req_id = ""
                    test_docstring = ast.get_docstring(node) or ""

                    test_detail = {
                        "test_name": test_name,
                        "test_id": test_id if test_id else "NA",
                        "test_tags": [],
                        "test_doc": test_docstring,
                        "file_path": file_path,
                    }
                    test_details.append(test_detail)

            return test_details
        except Exception as e:
            self.logger.error(f"Error getting test details: {e}")
            return []

    def get_scenario_paths(self, file_content, py_file_path):
        """
        Get the list of files in which BDD scenarios are present

        Args:
            file_content (str): Test file content
            py_file_path (str): Python test file path

        Returns:
            list: List of .feature files
        """
        try:
            folder_location = os.path.dirname(py_file_path)
            pattern = r"@?scenario(?:s)?\((.*?)\)"
            matches = re.findall(pattern, file_content)
            scenario_paths = []
            for match in matches:
                paths = [path.strip().strip("'\"") for path in match.split(",")]
                for path in paths:
                    full_path = os.path.join(folder_location, path)
                    if ".feature" in full_path and full_path not in scenario_paths:
                        scenario_paths.append(full_path)
            return scenario_paths
        except Exception as e:
            self.logger.error(f"Error while getting scenario paths: {e}")
            return []

    def parse_feature_file(self, feature_file_paths, file_path):
        """
        Parse the test case in .feature file

        Args:
            feature_file_paths (list): List of .feature files
            file_path (str): .py file path for a corresponding .feature file

        Returns:
            list:  Parsed data. Empty list in case of errors
        """
        try:
            parsed_info = []
            for feature_file_path in feature_file_paths:
                if not os.path.exists(feature_file_path):
                    continue
                with open(feature_file_path, "r") as file:
                    content = file.read()
                test_ids = re.findall(r"@(TC-\S+)", content)
                test_names = re.findall(r"Scenario:\s*(.*)", content)
                for test_name in test_names:
                    parsed_info.append(
                        {
                            "test_name": test_name.strip(),
                            "test_id": "",
                            "test_tags": [],
                            "test_doc": "",
                            "file_path": file_path,
                        }
                    )
            return parsed_info
        except Exception as e:
            self.logger.error(f"Error while parsing feature file: {e}")
            return []

    def get_test_scenario_details(self, file_path):
        """
        Get the test scenario details for given test file

        Args:
            file_path (str): Test file path

        Returns:
            list: Test scenarios list
        """
        try:
            test_scenarios = []
            with open(file_path, "r") as file:
                content = file.read()
                if self.is_pytest_bdd(content):
                    feature_file_paths = self.get_scenario_paths(content, file_path)
                    test_scenarios = self.parse_feature_file(
                        feature_file_paths, file_path
                    )
                    return test_scenarios
                else:
                    test_scenarios = self.get_test_details(content, file_path)
                    if test_scenarios:
                        return test_scenarios
                    else:
                        self.logger.warning(f"Not a pytest file {file_path}")
        except Exception as e:
            self.logger.error(f"Error while getting test scenario details: {e}")
            return []
