from abc import ABC, abstractmethod


class TestParserBase(ABC):
    """ 
    Base class for Test Parser

    Args:
        logger (LoggerService.logger): logger object to log messages
    """

    def __init__(self, logger):
        self.logger = logger

    @abstractmethod
    def parse(self, suite_name, directory_path, project_id, user_id, test_source_id):
        """
        Parse the test details

        Args:
            suite_name (str): Name of the suite folder consisting of test files 
            directory_path (str):  Root directory path
            project_id (str):  Project ID
            user_id (str):  User ID 
        """
        pass
