import os
import json
import requests
from test_agent.utility.service_initializer import ServiceInitializer
from test_agent.common.test_agent_dto import AgentInfo


class Publisher:
    """
    class to publish agent messages over message queue

    Args:
        msg_obj (MessagingService): message queue object to publish messages
    """

    def __init__(self, msg_obj):
        try:
            self._service_initializer = ServiceInitializer()
            self._msg_obj = msg_obj
        except Exception as e:
            print(e)

    def publish_agent_status(self, status):
        """
        Publish agent status

        Args:
            agent_name (str): Name of the Agent
            uuid (str): ID of the Agent
            status (str): Status of the Agent

        """
        try:
            AgentInfo().status = status
            payload = {
                "agent_name": AgentInfo().name,
                "agent_id": AgentInfo().uuid,
                "agent_status": status,
            }
            routing_key = "*.agent_status"
            body = json.dumps(payload)
            exchange = "agent_status_exchange"
            self._msg_obj.publish_message(exchange, routing_key, body)
        except Exception as e:
            print(e)

    def publish_console_log(self, data):
        """
        Publish agent console log

        Args:
            data (dict): Console log Data built by MessageBuilder
        """
        try:
            routing_key = (
                str(data.get("project_id", ""))
                + "."
                
                + str(data.get("execution_id", ""))
                + "."
                + str(data.get("agent_name", ""))
                + ".consolelogs"
            )
            exchange = "console_log_exchange"
            self._msg_obj.publish_message(
                exchange, routing_key, json.dumps(data)
            )
        except Exception as e:
            print("Error while publishing console log:", e)

    def publish_test_status(self, data):
        """
        Publish real time test status

        Args:
            data (dict): Test status Data built by MessageBuilder
        """
        try:
            routing_key = (
                str(data.get("project_id", ""))
                + "."
                
                + str(data.get("execution_id", ""))
                + "."
                + str(data.get("agent_name", ""))
                + ".teststatus"
            )
            exchange = "test_status_exchange"
            self._msg_obj.publish_message(exchange, routing_key, json.dumps(data))
        except Exception as e:
            print("Error while publishing test status:", e)

    def publish_execution_status(self, data):
        """
        Publish execution status message

        Args:
            data (dict): Execution status Data.
        """
        try:
            routing_key = "test_execution_status_queue"
            exchange = ""
            body = json.dumps(data)
            self._msg_obj.publish_message(exchange, routing_key, body)
        except Exception as e:
            print("Error while publishing execution status:", e)

    def publish_execution_completed(self, data):
        """
        Publish execution completed message

        Args:
            data (dict): Execution completion Data built by MessageBuilder
        """
        try:
            routing_key = data.get("agent_name", "") + ".executioncomplete"
            exchange = "execution_completion_status_exchange"
            body = json.dumps(data)
            self._msg_obj.publish_message(exchange, routing_key, body)
        except Exception as e:
            print("Error while publishing execution completed:", e)

    def publish_report(
        self, project_id, execution_id, execution_type, file_to_send
    ):
        """
        Publish execution reports

        Args:
            project_id (str): Project ID
            
            execution_id (str): Orchestration Execution ID
            file_to_send (str): Encoded data for file to send
        """
        try:
            with open(file_to_send, "rb") as file:
                file_name = os.path.basename(file_to_send)
                content_to_send = {
                    "project_id": project_id,
                    "execution_id": execution_id,
                    "execution_type": execution_type,
                    "agent": {
                        "agent_id": AgentInfo().uuid,
                        "agent_name": AgentInfo().name,
                    },
                    "file_name": file_name,
                }
                files = {"file": file}
                print("Uploading reports to server ->" + self._service_initializer.logger_url + "/logs/execution/upload")
                response = requests.post(
                    self._service_initializer.logger_url + "/logs/execution/upload",
                    data=content_to_send,
                    files=files,
                )
                print("Response Status Code: ", response.status_code)

        except Exception as e:
            print("Error while uploading reports: ", e)

    def publish_parsed_tests(self, data):
        """
        Publish parsed tests data

        Args:
            data (dict): Data built in the Parse state
        """
        try:
            self._msg_obj.publish_message(
                "", routing_key="test_parsing_response_queue", body=json.dumps(data)
            )
        except Exception as e:
            print("Error while publishing parsed tests:", e)

    def publish_register_agent(self, data):
        """
        Publish message to Register agent with test engine

        Args:
            data (dict): Data built in the new state
        """
        try:
            body = json.dumps(data)
            self._msg_obj.publish_message(
                "agent_registration_exchange", "register", body
            )
        except Exception as e:
            print("Error while publishing register agent:", e)
