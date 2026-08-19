import re
import os
from test_agent.common.parser_base import TestParserBase
import uuid


class SpecflowParser(TestParserBase):
    """
    A plugin for parsing Robot Framework tests.
    It inherits from the TestParserBase class.

    Args:
        logger (LoggerService.logger):  Logger to log messages
    """

    def __init__(self, logger):
        self.logger = logger

    def extract_scenario_names(self, file_path):
        """
        Get the scenario details from test file

        Args:
            file_path (str): Path of the test file

        Returns:
            list: Scenario details list
        """
        scenario_list = []
        with open(file_path, "r") as file:
            content = file.read()

        scenario_names = re.findall(r"Scenario(?: Outline)?: (.+)", content)
        for scenario in scenario_names:

            name_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, scenario)
            test_id = f"TC_AUTO_{name_uuid.hex[:8]}"
            scenario_list.append(
                {
                    "test_name": scenario,
                    "test_id": test_id,
                    "test_tags": [],
                    "test_doc": "",
                    "file_path": file_path,
                }
            )
        return scenario_list

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

            if suite_name == "":
                self.suite_path = directory_path
            else:
                for subdir, dirs, files in os.walk(directory_path):
                    for folder in dirs:
                        if folder == suite_name:
                            self.suite_path = os.path.join(subdir, folder)

            for subdir, dirs, files in os.walk(self.suite_path):
                for file_name in files:
                    file_path = subdir + os.sep + file_name
                    if file_path.endswith(".feature"):
                        scenario_list = self.extract_scenario_names(file_path)
                        temp_dict = {
                            "project_id": project_id,
                            "user_id": user_id,
                            "suite_name": os.path.basename(subdir),
                            "file_name": file_name,
                            "file_path": file_path,
                            "test_scenarios": scenario_list,
                            "test_fw_type": "SPECFLOW",
                            "test_source_id": test_source_id,
                        }
                        project_data.append(temp_dict)

            return project_data
        except Exception as e:
            self.logger.error(f"Error while parsing {e}")
            return []
