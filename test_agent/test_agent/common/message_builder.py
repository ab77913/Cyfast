import io


class MessageBuilder:
    """
    Class to build response messages

    Args:
        config (ConfigurationSettings):  Orchestration execution Configuration
    """

    def __init__(self, config) -> None:
        self.console_log_buffer = io.StringIO()
        self.console_log_download_buffer = io.StringIO()
        self.config = config

    def build_console_log_message(self, message=None):
        """
        Builds the console log message by using message stored in io buffer

        Args:
            message (str, optional): Custom message if any. Defaults to None.

        Returns:
            dict: Console message payload.
        """
        try:
            console_dict = {}
            consolelog = message or self.console_log_buffer.getvalue()
            if consolelog:
                self.console_log_download_buffer.write(consolelog)
                self.console_log_buffer.truncate(0)
                self.console_log_buffer.seek(0)
                console_dict["agent_type"] = self.config.agent_name
                console_dict["agent_name"] = self.config.agent_name
                console_dict["agent_id"] = self.config.agent_id
                console_dict["project_id"] = self.config.project_id
                 
                console_dict["execution_id"] = self.config.execution_id
                console_dict["log_text"] = consolelog
                console_dict["user_id"] = self.config.user_id
            return console_dict

        except Exception as e:
            print(e)

    def build_test_status_message(self, test_name, test_id, test_status, start_time="", end_time="", elapsed_time=""):
        """
        Builds the real time test status message

        Args:
            test_name (str): Name of the test
            test_id (str): ID of the test
            test_status (str): Status of the test
            start_time (str, optional): Test start time. Defaults to an empty string.
            end_time (str, optional): Test end time. Defaults to an empty string.
            elapsed_time (str, optional): Test elapsed time. Defaults to an empty string. 

        Returns:
            dict: Real time test status message payload.
        """
        real_time_status = { 
                            "project_id": self.config.project_id,
                            "execution_id": self.config.execution_id,
                            "user_id": self.config.user_id,
                            "test_case_name": test_name,
                            "test_case_status": test_status,
                            "test_case_id": test_id,
                            "test_start_time": start_time,
                            "test_end_time": end_time,
                            "test_elapsed_time": elapsed_time,
                            "agent_name": self.config.agent_name
                            }
        return real_time_status

    def build_orchestration_completion_message(self, test_execution_result_details, execution_status, message=""):
        """
        Builds the real time test status message

        Args:
            test_execution_result_details (list): Test Execution details
            execution_status (str): Overall execution status
            message (str): Execution custom message. Defaults to an empty string.

        Returns:
            dict: Orchestration completion message payload.
        """
        data = {
            "user_id": self.config.user_id,
            "project_id": self.config.project_id,
            
          
            "test_execution_result_details": test_execution_result_details,
            "execution_id": self.config.execution_id,
            "agent_name": self.config.agent_name,
            "execution_status": execution_status,
            "message": message
        }

        return data

    def build_execution_status_message(self, status):
        """
        Builds the real time orchestration status message

        Args:
            status (str): Current orchestration status

        Returns:
            dict: Orchestration status message payload.
        """
        data = {
            "project_id": self.config.project_id,
            
            "execution_id": self.config.execution_id,
            "agent_name": self.config.agent_name,
            "status": status
        }
        return data
