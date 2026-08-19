import base64
from test_agent.common.repo_base import RepoBase
from test_agent.common.message_builder import MessageBuilder
from test_agent.common.configuration_settings import ConfigurationSettings
import tempfile
import git
import os


class GitRepo(RepoBase):
    """
    A plugin for cloning git repository
    It inherits from the RepoBase class.

    Args:
        logger (LoggerService.logger):  Logger to log messages
    """

    def __init__(self, logger, publisher=None):
        super().__init__(logger, publisher)

    def configure_plugin(self, data):
        self.config = ConfigurationSettings()
        self.config.user_id = data["user_id"]
        self.config.project_id = data["project_id"]
         
        self.config.execution_id = data["execution_id"]
        self.config.agent_name = data["agent_name"]
        self.config.agent_id = data["agent_id"]
        self.config.agent_type = data["agent_type"]
        self.msg_builder = MessageBuilder(self.config)

    def configure_repository_parameters(self, repo_info):
        """
        Configure the repository parameter which are used to connect and fetch the test case.

        Args:
            repo_info (dict): Git configuration from the engine
        """
        try:
            self.url = repo_info.get("url", "")
            self.branch = repo_info.get("branch", "")
            self.username = repo_info.get("username", "")
            self.password = repo_info.get("password", "")
            self.access_token = repo_info.get("access_token", "")
        except Exception as e:
            self.logger.error(f"Error while configuring repo parameters: {e}")

    def test_folder_exists(self, file_name):
        """
        Check if test folder is already present or not

        Args:
            file_name (str):    Expected test file name 

        Returns:
            str: Path of the test folder. Empty string if folder not present
        """
        temp_folder_path = tempfile.gettempdir()
        directories = [d for d in os.listdir(temp_folder_path) if os.path.isdir(
            os.path.join(temp_folder_path, d))]
        result_folders = [os.path.join(temp_folder_path, d)
                          for d in directories if d.startswith(file_name)]
        if result_folders:
            return result_folders[0]
        else:
            return ''

    def download(self, data, agent_name, parsing):
        """
        Clone or update the git repository

        Args:
            data (dict): Clone request data from engine
            agent_name (str): Name of the test agent
            parsing (bool): Is cloning being done for parsing (False for Test Execution)

        Returns:
            str: Directory path after cloning or updating the repository. None in case of errors
        """
        error_message = ""
        try:
            # Define persistent base folder
            home_dir = os.path.expanduser("~")
            repo_base_path = os.path.join(home_dir, "CyFast_git_repos")
            os.makedirs(repo_base_path, exist_ok=True)

            # Unique folder per project/agent/execution
            file_prefix = "parse_" if parsing else "test_"
            file_name = f"{file_prefix}{data.get('execution_id','')}_{agent_name}"
            self.directory_path = os.path.join(repo_base_path, file_name)

            test_case_source = data.get("test_cases_source", "")

            if not parsing:
                self.configure_plugin(data)
            self.configure_repository_parameters(repo_info=test_case_source.get("configs", {}))

            # Check if repo already exists
            if os.path.isdir(os.path.join(self.directory_path, ".git")):
                print(f"Repository already exists at {self.directory_path}, pulling latest changes...")
                repo = git.Repo(self.directory_path)
                origin = repo.remotes.origin
                origin.pull()
            else:
                print(f"Cloning repository to {self.directory_path}")
                credentials = base64.b64encode(
                    f"{self.access_token}:".encode("latin-1")
                ).decode("latin-1")

                git.Repo.clone_from(
                    self.url,
                    self.directory_path,
                    c=f"http.{self.url}/.extraheader=AUTHORIZATION: basic {credentials}",
                    branch=self.branch,
                    depth=1,
                    allow_unsafe_options=True
                )

            return self.directory_path

        except git.exc.GitError as e:
            error_message = str(e)
            self.logger.error(f"Git Error: {e}")

        except Exception as e:
            error_message = str(e)
            self.logger.error(e)

        if not parsing:
            message_to_publish = self.msg_builder.build_console_log_message(error_message)
            if message_to_publish:
                self.publisher.publish_console_log(message_to_publish)

            message_to_publish = self.msg_builder.build_orchestration_completion_message(
                [], "ABORTED", "Unable to clone or update the repository"
            )
            self.publisher.publish_execution_completed(message_to_publish)
            self.logger.debug(f"Execution Completion Message: {message_to_publish}")

        return None