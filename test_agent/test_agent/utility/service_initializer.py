import os
import json
import requests
from test_agent.utility.messaging_service.messaging_service import MessagingService
from test_agent.utility.logger_service.logger_service import LoggerService
from dataclasses import dataclass
from typing import Optional
from dataclasses import asdict


@dataclass
class MessageConfig:
    """
    Dataclass representing configuration for message queue.

    Args:
        host (str): Hostname of the messaging client
        password (str): Password of the messaging client
        port (str): Port of the messaging client
        username (str): username of the messaging client
        vhost (str): Vhost of the messaging client, if any.
    """

    host: str
    password: str
    port: int
    username: str
    vhost: str


@dataclass
class LoggerConfig:
    """
    Dataclass representing configuration for logger service.

    Args:
        enable_file_logging (bool): Enable logging to a log file
        enable_http_post_logging (bool): Enable logging to a http url
        enable_rabbitmq_logging (bool): Enable logging to a rabbit message queue
        file_name (str): File name for .log file
        logger_format (str): Format of the log message
        logger_service_url (str): URL for logger service
        rabbit_mq_host (str): Enable logging to a log file
    """

    enable_file_logging: bool
    enable_http_post_logging: bool
    enable_rabbitmq_logging: bool
    file_name: str
    logger_format: str
    logger_service_url: str
    rabbit_mq_host: str


class ServiceInitializer:
    """
    Singleton class for initializing services based on configurations.
    Args:
        agent_name (str, optional): Name of the agent. Required when creating instance. Optional for rest of the calls

    Returns:
        ServiceInitializer: The instance of the ServiceInitializer.
    """

    _instance = None
    agent_name = None
    logger_url = None

    def __new__(cls, agent_name=None):
        """
        Create a new instance of ServiceInitializer if it doesn't exist,
        and initialize it with provided agent_name.

        """
        if cls._instance is None:
            cls._instance = super(ServiceInitializer, cls).__new__(cls)
            cls._instance._load_config(agent_name)
            cls._instance.check_logger_service()
        return cls._instance

    def _load_config(self, agent_name):
        """
        Load configurations from YAML file.

        Args:
            agent_name (str): Name of the agent.

        Raises:
            Exception: If there's an error reading the config file.
        """
        try:
            self.agent_name = agent_name
            dir_path = os.path.dirname(os.path.realpath(__file__))
            self.config_folder = os.path.join(dir_path, "..", "config")
            self.mq_config = self.get_message_queue_config()
            self.logger_config = self.get_logger_config()

        except Exception as e:
            print("Error while reading service config file: ", e)

    def get_message_queue_config(self):
        """
        Extract message queue configuration from loaded service configuration.

        Returns:
            dict: Message queue configuration as a dictionary.

        Raises:
            Exception: If there's an error accessing or parsing the configuration.
        """
        try:
            messaging_config_file_path = os.path.join(
                self.config_folder, "messaging.json"
            )

            with open(messaging_config_file_path, "r") as file:
                config = json.load(file)

            run_env = os.getenv("AGENT_RUN_ENV", "local")
            message_queue_config = config.get("rabbitmq", {}).get(run_env, {})
            mq_config = MessageConfig(
                host=message_queue_config["host"],
                port=message_queue_config["port"],
                username=message_queue_config["username"],
                password=message_queue_config["password"],
                vhost=message_queue_config["vhost"],
            )
            return asdict(mq_config)
        except Exception as e:
            print("Error get_message_queue_config", e)

    def set_up_message_queue(self):
        """
        Set up the messaging service using the configured message queue settings.

        Returns:
            MessagingService: Instance of the messaging service.

        Raises:
            Exception: If there's an error setting up the messaging service.
        """
        try:
            return MessagingService("RabbitMQ", **self.mq_config)
        except Exception as e:
            print("RabbitMQ Service is Not Running or connection details are wrong")
            os.kill(os.getpid(), 9)

    def get_logger_config(self):
        """
        Extract logger configuration from loaded service configuration.

        Returns:
            dict: Logger configuration as a dictionary.

        Raises:
            Exception: If there's an error accessing or parsing the configuration.
        """
        try:

            logging_config_file_path = os.path.join(self.config_folder, "logging.json")

            with open(logging_config_file_path, "r") as file:
                config = json.load(file)

            run_env = os.getenv("AGENT_RUN_ENV", "local")
            logger_config = config.get(run_env, {})
            self.logger_url = logger_config.get("logger_service_url")

            logger_config_instance = LoggerConfig(
                enable_file_logging=logger_config["enable_file_logs"],
                enable_http_post_logging=logger_config["enable_http_post_logs"],
                enable_rabbitmq_logging=logger_config["enable_rabbitmq_logs"],
                file_name=self.agent_name,
                logger_format="| %(levelname)s | %(asctime)s | %(name)s | %(filename)s | Fn Name: %(funcName)s | Line No: %(lineno)d | %(message)s |",
                logger_service_url=logger_config.get("logger_service_url"),
                rabbit_mq_host=logger_config.get("rabbitmq_logging_hostname"),
            )
            return asdict(logger_config_instance)
        except Exception as e:
            print("Error get_logger_config", e)

    def set_up_logger(self, agent_name, logger_name, console_logs=False):
        """
        Set up the logger service using the configured logger settings.

        Args:
            agent_name (str): Name of the agent.
            logger_name (str): Name of the logger.

        Returns:
            LoggerService: Instance of the logger service.

        Raises:
            Exception: If there's an error setting up the logger service.
        """
        try:
            documents_folder = (
                os.path.join(os.environ["USERPROFILE"], "Documents")
                if os.name == "nt"
                else os.path.expanduser("~/Documents")
            )
            file_path = os.path.join(documents_folder, "CyfastLogs", "AgentLogs")
            if not os.path.exists(file_path):
                os.makedirs(file_path)

            return LoggerService(
                console_logs=console_logs,
                logger_name=logger_name,
                file_path=file_path,
                **self.logger_config
            )
        except Exception as e:
            print("Error while setting up logger: ", e)

    def check_message_service(self):
        """
        Check if message service is running and working.

        Returns:
            bool: Is message service running and working
        """
        try:
            chn_obj = self.set_up_message_queue()
            chn_obj.publish_message(exchange="", routing_key="test", body="test")
            return True
        except Exception as e:
            print("[X] Messaging Service is Not Running")
            return False

    def check_logger_service(self):
        """
        Check if frontend logger service is running and working.

        Returns:
            bool: Is frontend logger service running and working
        """
        try:
            server_url = self.logger_config.get("logger_service_url")
            endpoints = [
                "/logs/activity",
                "/logs/application",
            ]
            all_running = True

            for endpoint in endpoints:
                try:
                    url = server_url + endpoint
                    response = requests.get(url, timeout=0.5)
                    if response.status_code != 200:
                        all_running = False
                except requests.ConnectionError:
                    all_running = False
            if not all_running:
                self.logger_config["enable_http_post_logging"] = False
                print("[X] Logger Service is Not Running, Skipping HTML logs")

        except Exception as e:
            print(e)
