import os
import sys
import logging
import pika
import requests
from python_logging_rabbitmq import RabbitMQHandler
from concurrent.futures import ThreadPoolExecutor


class HttpPostHandler(logging.Handler):
    """
    Custom logging handler that sends logs to a specified HTTP endpoint.


    Args:
        url (str): The base URL of the logging service.
        agent_name (str): Name of the agent or application logging the messages.
    """

    def __init__(self, url, agent_name):
        super().__init__()
        self.url = url
        self.agent_name = agent_name
        self.executor = ThreadPoolExecutor(max_workers=1)

    def emit(self, record):
        """
        Emit a log record.

        Args:
            record (logging.LogRecord): The log record to emit.

        Raises:
            IOError: If the POST request fails or returns a non-200 status code.

        Note:
            This method is an override of logging.Handler's emit method.
        """
        try:
            if record.levelno == logging.INFO:
                log_entry = {
                    "source": record.name,
                    "group": "TEST_AGENT",
                    "type": record.levelname,
                    "server": "",
                    "message": record.getMessage(),
                    "details": "",
                    "username": self.agent_name,
                }
                # response = requests.post(self.url + "/logs/activity", data=log_entry)
                self.executor.submit(self.send_log, log_entry, "/logs/activity")

            elif record.levelno == logging.DEBUG:
                pass  # Debug log not being sent

            else:
                log_entry = {
                    "source": record.name,
                    "type": record.levelname,
                    "server": "Server",
                    "message": record.getMessage(),
                    "details": record.msg,
                    "file": record.filename,
                    "line": record.lineno,
                    "username": self.agent_name,
                }
                # response = requests.post(self.url + "/logs/application", data=log_entry, timeout=0.1)
                self.executor.submit(self.send_log, log_entry, "/logs/application")
        except Exception as e:
            print("Could not send log due to non availability of logger service")

    def send_log(self, log_entry, endpoint):
        """
        Thread for sending logs.

        Args:
            log_entry (dict): Log data.
            endpoint (str): API endpoint.
        """
        try:
            response = requests.post(self.url + endpoint, data=log_entry)
            if response.status_code != 200:
                print(f"Failed to send log entry. Status code: {response.status_code}")
        except Exception as e:
            pass


class LoggerService:
    """
    A service for configuring and managing multiple logging handlers including file, RabbitMQ, and HTTP POST.

    Args:
        logger_name (str): The name of the logger.
        logger_format (str): The format string for log messages.
        rabbit_mq_host (str): The host address of RabbitMQ server.
        logger_service_url (str): The URL for HTTP POST logging service.
        file_path (str): The path where log files will be stored.
        file_name (str): The name of the log file.
        enable_file_logging (bool, optional): Enable or disable file logging. Defaults to True.
        enable_rabbitmq_logging (bool, optional): Enable or disable RabbitMQ logging. Defaults to True.
        enable_http_post_logging (bool, optional): Enable or disable HTTP POST logging. Defaults to True.
    """

    def __init__(
        self,
        console_logs,
        logger_name,
        logger_format,
        rabbit_mq_host,
        logger_service_url,
        file_path,
        file_name,
        enable_file_logging=True,
        enable_rabbitmq_logging=True,
        enable_http_post_logging=True,
    ):
        try:
            self.console_logs = console_logs
            self.logger_format = logger_format
            self.rabbit_mq_host = rabbit_mq_host
            self.logger_service_url = logger_service_url
            self.file_path = file_path
            self.file_name = file_name
            self.enable_file_logging = enable_file_logging
            self.enable_rabbitmq_logging = enable_rabbitmq_logging
            self.enable_http_post_logging = enable_http_post_logging
            self.logger = logging.getLogger(
                "CyFastTestAgent/" + file_name + "/" + logger_name
            )
            self.logger.setLevel(logging.DEBUG)
            self.clean_existing_handlers()

            if self.enable_rabbitmq_logging:
                self.initialize_rabbitmq_logging()

            if self.enable_file_logging:
                self.initialize_file_logging()

            if self.enable_http_post_logging:
                self.initialize_http_post_logging()

            if self.console_logs:
                console_handler = logging.StreamHandler()
                console_handler.setLevel(logging.DEBUG)
                self.logger.addHandler(console_handler)
        except Exception as e:
            print(e)

    def clean_existing_handlers(self):
        """
        Clears any existing handlers attached to the logger instance.
        """
        try:
            for handler in self.logger.handlers[:]:
                self.logger.removeHandler(handler)
        except Exception as e:
            print(e)

    def initialize_file_logging(self):
        """
        Initializes file logging if enabled, setting up a FileHandler with the specified format.
        """
        try:
            if self.enable_file_logging:
                formatter = logging.Formatter(fmt=self.logger_format)
                file_handler = logging.FileHandler(
                    os.path.join(self.file_path, self.file_name) + ".log"
                )
                file_handler.setFormatter(formatter)
                self.logger.addHandler(file_handler)
        except Exception as e:
            print(e)

    def initialize_rabbitmq_logging(self):
        """
        Initializes RabbitMQ logging if enabled, creating a connection to RabbitMQ and setting up a RabbitMQHandler with the specified format.
        """
        try:
            if not self.enable_rabbitmq_logging:
                return
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(host=self.rabbit_mq_host, heartbeat=1200)
            )
            rabbitmq_channel = connection.channel()
            rabbitmq_channel.exchange_declare(
                exchange="cyfastlogs", exchange_type="topic"
            )

            formatter = logging.Formatter(fmt=self.logger_format)
            rabbitmq_handler = RabbitMQHandler(
                host=self.rabbit_mq_host, exchange="cyfastlogs", close_after_emit=True
            )
            rabbitmq_handler.setFormatter(formatter)
            self.logger.addHandler(rabbitmq_handler)
        except Exception as e:
            print(e)

    def initialize_http_post_logging(self):
        """
        Initializes HTTP POST logging if enabled, setting up an HttpPostHandler with the specified format.
        """
        try:
            if self.enable_http_post_logging:
                formatter = logging.Formatter(fmt=self.logger_format)
                http_post_handler = HttpPostHandler(
                    self.logger_service_url, self.file_name
                )
                http_post_handler.setFormatter(formatter)
                self.logger.addHandler(http_post_handler)
        except Exception as e:
            print(e)
