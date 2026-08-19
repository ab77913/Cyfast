import os
from robot.api import TestSuiteBuilder
from test_agent.common.parser_base import TestParserBase
import uuid


class RobotParser(TestParserBase):
    """
    A plugin for parsing Robot Framework tests.
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
            test_id = ""
            suite_path = ""
            if suite_name == "":
                suite_path = directory_path
            else:
                for subdir, dirs, files in os.walk(directory_path):
                    for folder in dirs:
                        if folder == suite_name:
                            suite_path = os.path.join(subdir, folder)

            for subdir, dirs, files in os.walk(suite_path):
                for filename in files:
                    filepath = subdir + os.sep + filename
                    if filepath.endswith(".robot"):
                        file_path = filepath
                        new_file_path = file_path.replace(directory_path, "")
                        suite = TestSuiteBuilder().build(filepath)
                        test_list = []
                        for test in suite.tests:
                            test_id = ""
                            if test.tags:
                                for tag in test.tags:
                                    if tag.startswith("TC"):
                                        test_id = tag
                                    else:
                                        test_id = ""
                            if test_id == "":
                                name_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, test.name)
                                test_id = f"TC_AUTO_{name_uuid.hex[:8]}"

                            test_case_dict = {
                                "test_id": test_id,
                                "test_name": test.name,
                                "test_tags": list(test.tags),
                                "test_doc": test.doc,
                                "file_path": new_file_path,
                            }
                            test_list.append(test_case_dict)

                        temp_dict = {
                            "project_id": project_id,
                            "user_id": user_id,
                            "suite_name": os.path.basename(subdir),
                            "file_name": filename,
                            "file_path": new_file_path,
                            "test_scenarios": test_list,
                            "test_fw_type": "ROBOT",
                            "test_source_id": test_source_id,
                        }
                        project_data.append(temp_dict)
            return project_data
        except Exception as e:
            self.logger.error(f"Error while parsing {e}")
            return []
