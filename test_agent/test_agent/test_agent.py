import sys
import os

sys.path.insert(0, os.getcwd())  # nopep8
import time
from threading import Thread, Event
from unique_names_generator.data import COLORS, NAMES
from unique_names_generator import get_random_name
import argparse
import random
import json

from test_agent.__version__ import __version__
from test_agent.common.test_agent_dto import *
from test_agent.utility.service_initializer import ServiceInitializer
from test_agent.common.publisher import Publisher
from test_agent.agent_controller import AgentController
from test_agent.configure_agent import ConfigureTestAgent
from test_agent.utility.heartbeat_manager import HeartbeatManager


class TestAgent:
    def __init__(self, agent_name, agent_type, agent_mode, console_logs=False):
        self.agent_name = agent_name
        self.agent_type = agent_type
        self.agent_mode = agent_mode
        self.engine_ready_event = Event()
        self.agent_closure_event = Event()
        self.agent_threads = []
        self.service_initializer = ServiceInitializer(agent_name)
        self.log = self.service_initializer.set_up_logger(
            agent_name, agent_name, console_logs
        )
        self.msg = self.service_initializer.set_up_message_queue()
        self.publisher = Publisher(self.msg)
        self.controller = AgentController(
            agent_name, self.log, self.msg, self.publisher, self.agent_closure_event
        )

    def execution_deploy_callback(self, ch, method, properties, payload):

        self.log.logger.debug("[x] Received execution deploy command")
        self.controller.start_execution(payload)

    def agent_registered_callback(self, ch, method, properties, payload):
        heartbeat_thread = Thread(
            target=HeartbeatManager(self.agent_closure_event).heartbeat, daemon=True
        )
        heartbeat_thread.start()
        executioncommand_thread = Thread(
            target=self.execution_command_thread, daemon=True
        )
        executioncommand_thread.start()

        self.agent_threads.append(heartbeat_thread)
        self.agent_threads.append(executioncommand_thread)

        self.log.logger.debug("[x] Received agent registered acknowledgment")
        self.controller.agent_registered(payload)
        self.engine_ready_event.set()

    def agent_command_callback(self, ch, method, properties, payload):
        self.log.logger.debug("[x] Received agent command")
        self.controller.handle_agent_command(payload)

    def parsing_callback(self, ch, method, properties, payload):
        self.log.logger.debug("[x] Received parsing command")
        self.controller.parse_data(payload)

    def execution_control_callback(self, ch, method, properties, payload):
        self.log.logger.debug("[x] Received execution control command")
        self.controller.execution_control_command(payload)

    def execution_command_thread(self):
        """
        Thread function to handle execution commands.
        """
        try:
            self.sub_exec_cmd_obj = self.service_initializer.set_up_message_queue()
            self.sub_exec_cmd_obj.exchange_declare(
                exchange="orchestration_control_exchange", exchange_type="topic"
            )

            """
            Used to get the execution command from the test engine.
            """
            self.sub_exec_cmd_obj.queue_declare(
                queue=self.agent_name + "control_queue", exclusive=True
            )
            self.sub_exec_cmd_obj.queue_bind(
                exchange="orchestration_control_exchange",
                queue=self.agent_name + "control_queue",
                routing_key=self.agent_name + ".command",
            )
            self.sub_exec_cmd_obj.basic_consume(
                queue=self.agent_name + "control_queue",
                auto_ack=True,
                callback=self.execution_control_callback,
            )

            print("Execution command receiver started ")
            while not self.agent_closure_event.is_set():
                self.sub_exec_cmd_obj.process_data_events(time_limit=1)

        except Exception as e:
            self.log.logger.error(e)
            sys.exit(1)

    def listener(self, parsing_enabled=False):
        try:
            self.msg.exchange_declare(
                exchange="agent_registration_exchange", exchange_type="direct"
            )
            self.msg.exchange_declare(
                exchange="agent_status_exchange", exchange_type="topic"
            )
            self.msg.exchange_declare(
                exchange="console_log_exchange", exchange_type="topic"
            )
            self.msg.exchange_declare(
                exchange="test_status_exchange", exchange_type="topic"
            )
            self.msg.exchange_declare(
                exchange="execution_completion_status_exchange", exchange_type="topic"
            )

            self.msg.exchange_declare(
                exchange="agent_execution_deploy_exchange", exchange_type="topic"
            )
            self.msg.queue_declare(
                queue=self.agent_name + "Receive-queue", exclusive=True
            )
            self.msg.queue_bind(
                exchange="agent_execution_deploy_exchange",
                queue=self.agent_name + "Receive-queue",
                routing_key=self.agent_name + ".*",
            )
            self.msg.basic_consume(
                queue=self.agent_name + "Receive-queue",
                auto_ack=True,
                callback=self.execution_deploy_callback,
            )

            self.msg.exchange_declare(
                exchange="ack_agent_registered", exchange_type="topic"
            )
            self.msg.queue_declare(
                queue=self.agent_name + "_registered", exclusive=True
            )
            self.msg.queue_bind(
                exchange="ack_agent_registered",
                queue=self.agent_name + "_registered",
                routing_key=self.agent_name + ".*",
            )
            self.msg.basic_consume(
                queue=self.agent_name + "_registered",
                auto_ack=True,
                callback=self.agent_registered_callback,
            )

            self.msg.exchange_declare(
                exchange="agent_command_exchange", exchange_type="topic"
            )
            self.msg.queue_declare(
                queue=self.agent_name + "command_queue", exclusive=True
            )
            self.msg.queue_bind(
                exchange="agent_command_exchange",
                queue=self.agent_name + "command_queue",
                routing_key=self.agent_name + ".*",
            )
            self.msg.basic_consume(
                queue=self.agent_name + "command_queue",
                auto_ack=True,
                callback=self.agent_command_callback,
            )

            self.msg.queue_declare(queue="test_execution_status_queue")

            if parsing_enabled:
                self.msg.queue_declare(queue="test_parsing_response_queue")
                self.msg.exchange_declare(
                    exchange="agent_parsing_exchange", exchange_type="topic"
                )
                self.msg.queue_declare(
                    queue=self.agent_name + "parse_queue", exclusive=True
                )
                self.msg.queue_bind(
                    exchange="agent_parsing_exchange",
                    queue=self.agent_name + "parse_queue",
                    routing_key=self.agent_name + ".*",
                )
                self.msg.basic_consume(
                    queue=self.agent_name + "parse_queue",
                    auto_ack=True,
                    callback=self.parsing_callback,
                )

            print(
                self.agent_type
                + " agent "
                + self.agent_name
                + " started. Registering with Engine..."
                + "Parsing Enabled: "
                + str(parsing_enabled)
            )

            agent_info_obj = AgentInfo(
                agent_name=self.agent_name,
                host=HostInfo().__dict__,
                mode=self.agent_mode,
                status=AgentStatus.REGISTERING.name,
                agent_type=self.agent_type,
                supported_execution_mode=getattr(
                    SupportedExecutionMode(), self.agent_type
                ),
                supported_execution_base=getattr(
                    SupportedExecutionBase(), self.agent_type
                ),
            )
            self.log.logger.debug(
                "Agent Info: " + json.dumps(agent_info_obj.agent.__dict__, indent=4)
            )

            engine_response_thread = Thread(target=self.check_engine_response)
            engine_response_thread.start()
            self.publisher.publish_register_agent(agent_info_obj.agent.__dict__)

            while not self.agent_closure_event.is_set():
                self.msg.process_data_events(time_limit=1)

        except KeyboardInterrupt:
            print("Agent stopped by user")
            self.publisher.publish_agent_status(AgentStatus.SUSPENDED.name)
            self.log.logger.info(f"Agent {self.agent_name} stopped by user")
            self.engine_ready_event.set()
            self.agent_closure_event.set()
            for thread in self.agent_threads:
                thread.join()

        except Exception as e:
            print(f"Agent encountered an error: {e}")
            self.log.logger.error(f"Agent encountered an error: {e}")

    def check_engine_response(self):
        if not self.engine_ready_event.wait(timeout=10):
            print("No response from engine, exiting...")
            self.log.logger.error("No response from engine, exiting...")
            self.agent_closure_event.set()
            for thread in self.agent_threads:
                thread.join()


def cyfast_test_agent_main(agent_type, agent_name, parsing_enabled, console_logs):

    mode = AgentMode._member_names_ if parsing_enabled else [AgentMode.EXECUTOR.name]
    name = agent_name or get_random_name(
        combo=[NAMES, COLORS], separator="_"
    ) + "_" + str(random.randint(0, 1000))
    type = agent_type or SupportedAgentPlugins.ROBOT.name

    agent = TestAgent(name.upper(), type.upper(), mode, console_logs)

    agent.listener(parsing_enabled)


def main():
    """
    Entry point for the test agent script.
    """
    print(f"CyFAST Test Agent Version: {__version__}")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--version",
        action="version",
        version=f"CyFAST Test Agent Version: {__version__}",
    )
    parser.add_argument(
        "--config", action="store_true", help="Custom configuration for the agent."
    )
    parser.add_argument(
        "--view", action="store_true", help="Show current configuration of the agent."
    )

    parser.add_argument("--parse", action="store_true", help="Activate parsing mode")
    parser.add_argument("-n", "--name", help="Specify the agent name")
    parser.add_argument(
        "-t", "--type", help="Specify the Agent Type\npytest\nrobot\ncapl\nspecflow"
    )
    parser.add_argument(
        "--console", action="store_true", help="Show debug logs in terminal"
    )

    args = parser.parse_args()
    config_agent = ConfigureTestAgent()
    if args.config:
        config_agent.configure_agent()
        sys.exit(1)
    elif args.view:
        config_agent.view_configuration()
        sys.exit(1)
    elif args.type:
        if args.type.upper() not in SupportedAgentPlugins._member_names_:
            print("Unsupported Agent Type. Please choose type from the list below")
            for agent_plugin in SupportedAgentPlugins._member_names_:
                print("\u2022 " + agent_plugin)
            sys.exit(1)

    cyfast_test_agent_main(args.type, args.name, args.parse, args.console)


if __name__ == "__main__":
    main()
