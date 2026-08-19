from abc import ABC, abstractmethod
import os
import sys


class BaseFramework(ABC):
    def __init__(self, publisher, log, stop_execution_event, pause_execution_event):
        self.publisher = publisher
        self.log = log
        self.stop_execution_event = stop_execution_event
        self.pause_execution_event = pause_execution_event
        self.env_dict = {}
        self.sys_path_set = []

    @abstractmethod
    def configure(self): ...
    @abstractmethod
    def run(self): ...
    @abstractmethod
    def generate_and_upload_reports(self): ...

    def find_folder(self, root_folder, target_folder_name):
        """
        Find the folder in provided path

        Args:
            root_folder (str): Path of the root directory
            target_folder_name (str): Name of the folder to be searched.

        Returns:
            str: Entire path of the folder if found. Otherwise None
        """
        try:
            for root, dirs, files in os.walk(root_folder):
                if target_folder_name in dirs:
                    return os.path.join(root, target_folder_name)
            return None
        except Exception as e:
            self.log.logger.error(e)
            return None

    def clean_up_plugin(self):
        """
        Cleans up the plugin. Called at every orchestration execution end.
        """
        self.stop_execution_event.clear()
        self.pause_execution_event.clear()
        self.clear_environment_variable()
        self.clear_system_path()

    def set_system_path(self, data):
        """
        Sets the System PATH variables

        Args:
            data (dict): Request payload from the front end

        """
        try:
            for path in data:
                sys.path.append(path)
                self.sys_path_set.append(path)
                self.logger.debug(f"System path {path} set")
        except Exception as e:
            self.logger.error(e)

    def clear_system_path(self):
        """
        Clears the system PATH variable
        """
        try:
            for path in self.sys_path_set:
                self.log.logger.debug("BEFORE %s", sys.path)
                if path in sys.path:
                    sys.path.remove(path)
                self.log.logger.debug(
                    "AFTER %s",
                    sys.path,
                )
                self.sys_path_set.remove(path)
                self.log.logger.debug(f"System path {path} cleared")
        except Exception as e:
            self.log.logger.error(e)

    def set_environment_variable(self, data):
        """
        Sets the Environment variables

        Args:
            data (dict): Request payload from the front end

        """
        try:
            for env_var in data:
                if env_var.upper() == "PATH":
                    os.environ["PATH"] = (
                        os.getenv("PATH", "") + str(data[env_var]) + os.pathsep
                    )
                    self.env_dict["PATH"] = str(data[env_var])
                else:
                    os.environ[env_var] = str(data[env_var])
                    self.env_dict[env_var] = str(data[env_var])
        except Exception as e:
            self.logger.error(e)

    def clear_environment_variable(self):
        """
        Clears the environment variables
        """
        try:
            keys_to_remove = []
            for env_var in self.env_dict:
                if env_var.upper() == "PATH":
                    string_to_remove = self.env_dict.get(env_var, "") + os.pathsep
                    os.environ[env_var] = os.getenv(env_var).replace(
                        string_to_remove, ""
                    )
                    keys_to_remove.append(env_var)
                else:
                    keys_to_remove.append(env_var)

            for key in keys_to_remove:
                self.env_dict.pop(key)

        except Exception as e:
            self.log.logger.error(e)
