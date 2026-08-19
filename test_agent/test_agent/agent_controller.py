import sys
import os

sys.path.insert(0, os.getcwd())  # nopep8
import json
from threading import Event

from test_agent.common.test_agent_dto import *
from test_agent.plugins.git_plugin.git_plugin import GitRepo
from test_agent.common.framework_registry import (
    get_framework_executor_class,
    get_framework_parser_class,
)


class AgentController:

    def __init__(self, agent_name, log, msg, publisher, agent_closure_event):
        self.agent_name = agent_name
        self.log = log
        self.msg = msg
        self.publisher = publisher
        self.stop_execution_event = Event()
        self.pause_execution_event = Event()
        self.agent_closure_event = agent_closure_event

    def agent_registered(self, payload):
        data = json.loads(payload)
        AgentInfo().uuid = data.get("agent_id", "")
        if not AgentInfo().uuid:
            print(f"Did not receive uuid from Engine")
            self.agent_closure_event.set()
            return

        print("Registration successful with id: " + AgentInfo().uuid)
        self.publisher.publish_agent_status(AgentStatus.READY.name)

    def handle_agent_command(self, payload):
        self.log.logger.info(f"Handling command with payload: {payload}")
        data = json.loads(payload)
        command = data.get("command", "").upper()
        if command == "KILL":
            print("Received KILL command. Shutting down agent...")
            self.publisher.publish_agent_status(AgentStatus.DEAD.name)
            self.agent_closure_event.set()

    def parse_data(self, payload):
        try:
            self.log.logger.info(f"Parsing data with payload: {payload}")

            data = json.loads(payload)
            test_fw_type = data.get("test_fw_type", "").upper()
            if test_fw_type != AgentInfo().agent_type:
                self.log.logger.info(
                    f"Orchestration requested for {test_fw_type} while agent type is {AgentInfo().agent_type}"
                )
                self.publisher.publish_agent_status(AgentStatus.READY.name)
                return

            self.publisher.publish_agent_status(AgentStatus.PARSING.name)
            test_cases_source_type = (
                data.get("test_cases_source", {}).get("type", "").upper()
            )
            if test_cases_source_type == TestcaseSourceType.REPOSITORY.name:

                directory_path = GitRepo(self.log, self.publisher).download(
                    data, AgentInfo().name, True
                )
                if not directory_path:
                    self.log.logger.error(f"Could not Clone the repository")
                    return
            elif (
                test_cases_source_type == TestcaseSourceType.SHARED_DIRECTORY.name
                or test_cases_source_type == TestcaseSourceType.LOCAL_DIRECTORY.name
            ):
                directory_path = data.get("test_cases_source", {}).get(
                    "directory_path", ""
                )
                if not os.path.exists(directory_path):
                    self.log.logger.error(
                        f"Directory path {directory_path} does not exist"
                    )
                    return

            framework_cls = get_framework_parser_class(AgentInfo().agent_type)
            framework = framework_cls(self.log.logger)

            parsed_data = framework.parse(
                suite_name=data.get("test_cases_source", {}).get("suite_name", ""),
                directory_path=directory_path,
                project_id=data.get("project_id", ""),
                user_id=data.get("user_id", ""),
                test_source_id=data.get("test_source_id", ""),
            )

            if parsed_data is not None:
                self.log.logger.debug(f"Parsing Completed: {parsed_data}")
                self.publisher.publish_parsed_tests(parsed_data)
            else:
                self.log.logger.error(f"Could not parse")
            self.publisher.publish_agent_status(AgentStatus.READY.name)

            print("[Test Agent] Parsing finished")

        except Exception as e:
            self.log.logger.error(e)

    def execution_control_command(self, payload):
        self.log.logger.info(f"Received execution command with payload: {payload}")
        data = json.loads(payload)
        command = data.get("command", "").upper()
        if command == "STOP":
            self.stop_execution_event.set()
            self.publisher.publish_agent_status(AgentStatus.READY.name)
        elif command == "PAUSE":
            self.pause_execution_event.set()
            self.publisher.publish_agent_status(AgentStatus.PAUSED.name)
        elif command == "RESUME":
            self.pause_execution_event.clear()
            self.publisher.publish_agent_status(AgentStatus.RUNNING.name)
        else:
            self.log.logger.error(f"Unknown command: {command}")

    def start_execution(self, payload):
        try:
            self.pause_execution_event.clear()
            self.stop_execution_event.clear()
            data = json.loads(payload)
            self.log.logger.info(
                f"Received execution request with payload: {json.dumps(data,indent=4)}"
            )
            self.publisher.publish_agent_status(AgentStatus.RUNNING.name)
            self.publisher.publish_execution_status(
                {
                    "project_id": data.get("project_id"),
                    "execution_type": data.get("execution_type"),
                    "execution_id": data.get(
                        "execution_id"
                    ),
                    "agent_name": AgentInfo().name,
                    "status": "INPROGRESS",
                }
            )

            data["agent_name"] = self.agent_name
            data["agent_id"] = AgentInfo().uuid
            data["agent_type"] = AgentInfo().agent_type

            if not self.get_tests(data):
                self.log.logger.error("Could not get tests")
                self.publisher.publish_agent_status(AgentStatus.READY.name)
                return

            if data.get("execution_type") == "test_script":
                selected_test_cases = data.get("selected_test_cases", [])
                for test_case in selected_test_cases:
                    relative_path = test_case.get("file_path", "").lstrip("\\/")  # remove leading slash/backslash
                    file_path = os.path.join(data.get("directory_path"), *relative_path.split("\\"))
                
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)

                    automation_code = test_case.get("automation_code", "")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(automation_code)
                    print(f"Created test script: {file_path}")
            print(
                f"Execution started with ID "
                + str(data.get("execution_id", ""))
            )

            framework_cls = get_framework_executor_class(AgentInfo().agent_type)
            framework = framework_cls(
                self.publisher,
                self.log,
                self.stop_execution_event,
                self.pause_execution_event,
            )

            execution_status = framework.run(data)
            if execution_status:
                self.publisher.publish_agent_status(AgentStatus.REPORTING.name)
                framework.generate_and_upload_reports()
            print("[Test Agent] Execution finished")
            self.publisher.publish_agent_status(AgentStatus.READY.name)
        except Exception as e:
            self.log.error(e)
        finally:
            self.stop_execution_event.clear()
            self.pause_execution_event.clear()

    def get_tests(self, data):

        test_fw_type = data.get("test_fw_type", "").upper()
        if test_fw_type != AgentInfo().agent_type:
            self.log.logger.info(
                f"Orchestration requested for {test_fw_type} while agent type is {AgentInfo().agent_type}"
            )
            return False
        test_cases_source_type = (
            data.get("test_cases_source", {}).get("type", "").upper()
        )
        if test_cases_source_type == TestcaseSourceType.REPOSITORY.name:

            directory_path = GitRepo(self.log, self.publisher).download(
                data, AgentInfo().name, False
            )
            if directory_path is None:
                self.log.logger.error("Could Clone the repository")
                return False
            self.log.logger.debug("Downloaded repo %s", directory_path)

        elif (
            test_cases_source_type == TestcaseSourceType.SHARED_DIRECTORY.name
            or test_cases_source_type == TestcaseSourceType.LOCAL_DIRECTORY.name
        ):
            directory_path = data.get("test_cases_source", {}).get("directory_path", "")
            if not os.path.exists(directory_path):
                self.log.logger.error(f"Directory path {directory_path} does not exist")

                return False
        else:
            self.log.logger.error(
                f"Unknown Test case source type: {test_cases_source_type}"
            )
            return False

        data["directory_path"] = directory_path
        data["suite_name"] = data.get("test_cases_source", {}).get("suite_name", "")
        return True
