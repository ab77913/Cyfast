

from abc import ABC, abstractmethod


class RepoBase(ABC):
    """
    Base class for all Repository

    Args:
        logger (LoggerService.logger): logger object to log messages    
    """

    def __init__(self, logger, publisher=None):
        self.logger = logger
        self.publisher = publisher

    @abstractmethod
    def configure_repository_parameters(self, repo_info):
        """
        Configure the repository parameter which are used to connect and fetch the test case.


        Args:
            repo_info (dict): Repo configurations from the engine . 
        """
        pass

    @abstractmethod
    def download(self, data, agent_name, parsing):
        """
        Get the repo details and download the test scripts

        Args:
            data (dict): Request payload from the front end.
            agent_name (str): Name of the Agent
            parsing (bool): Is request for parsing.

        """
        pass
