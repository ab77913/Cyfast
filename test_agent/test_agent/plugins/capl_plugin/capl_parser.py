import os
import re
from test_agent.common.parser_base import TestParserBase


class CAPLParser(TestParserBase):
    """
    A plugin for parsing CAPL tests.
    It inherits from the TestParserBase class.

    Args:
        logger (LoggerService.logger):  Logger to log messages
    """

    def __init__(self, logger):
        self.logger = logger

    def check_testcase_presence(self, file_path):
        """
        Checks if the .CAN file has tests cases or not

        Args:
            file_path (str): Path for the .CAN file

        Returns:
            bool: Is file a test file
        """
        try:
            with open(file_path, "r") as file:
                pattern = re.compile(r"testcase", re.IGNORECASE)
                for line in file:
                    if re.search(pattern, line):
                        return True
            return False
        except FileNotFoundError:
            self.logger.error(f"Error: File '{file_path}' not found.")
            return False

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
            print("""Get repo info""")
            project_data = []
            suite_path = ""
            if suite_name == "":
                suite_path = directory_path
            else:
                for subdir, dirs, files in os.walk(directory_path):
                    for folder in dirs:
                        if folder == suite_name:
                            suite_path = os.path.join(subdir, folder)

            for subdir, dirs, files in os.walk(suite_path):
                for file_name in files:
                    if file_name.endswith(".can"):
                        file_path = os.path.join(subdir, file_name)
                        if self.check_testcase_presence(file_path):
                            file_dict = {
                                "project_id": project_id,
                                "user_id": user_id,
                                "suite_name": suite_name,
                                "file_name": file_name,
                                "filePath": file_path,
                                "test_scenarios": [],
                                "test_fw_type": "CAPL",
                                "test_source_id": test_source_id,
                            }
                            project_data.append(file_dict)

            return project_data
        except Exception as e:
            self.logger.error(e)
            return []
