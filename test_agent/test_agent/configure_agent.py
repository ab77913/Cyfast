import os
import json


class ConfigureTestAgent:
    """Class to handle configuration of the test agent."""

    def __init__(self):
        pass

    def configure_message_queue(self, config_folder):
        """
        Configure message queue using user input

        Args:
            config_folder (str): Path of config folder
        """
        print("Configuring Messaging Queue... ")
        # username = input("Enter rabbitmq username [guest]: ") or "guest"
        # password = input("Enter rabbitmq password [guest]: ") or "guest"
        # host = input("Enter the rabbimq host [localhost]: ") or "localhost"
        # port = input("Enter the rabbitmq port [5672]: ") or "5672"

        username = input("Enter RabbitMQ Username, press enter for default (guest): ").strip() or "guest"

        password = input("Enter RabbitMQ Password, press enter for default (guest): ").strip() or "guest"
        
        host = input("Enter RabbitMQ Host, press enter for default (localhost): ").strip () or "localhost"

        port = input("Enter RabbitMQ Port, press enter for default (5672): ") or "5672"

        messaging_config_file_path = os.path.join(config_folder, "messaging.json")

        with open(messaging_config_file_path, "r") as file:
            data = json.load(file)

        data["rabbitmq"]["local"].update(
            {"username": username, "password": password, "host": host, "port": port}
        )

        with open(messaging_config_file_path, "w") as file:
            json.dump(data, file, indent=4)

    def configure_logger(self, config_folder):
        """
        Configure logger  using user input

        Args:
            config_folder (str): Path of config folder
        """
        print("Configuring Logger... ")

        enable_http_log = (lambda x: True if x == "y" else False if x == "n" else True)(
            input(
                "Do you want to enable HTTP based logs [Y/N], press enter for default (Y): "
            )
            .strip()
            .lower()
        )

        enable_rabbitmq_log = (
            lambda x: True if x == "y" else False if x == "n" else True
        )(
            input(
                "Do you want to enable RabbitMQ based logs [Y/N], press enter for default (Y): "
            )
            .strip()
            .lower()
        )

        enable_file_log = (lambda x: True if x == "y" else False if x == "n" else True)(
            input(
                "Do you want to enable File based logs [Y/N], press enter for default (Y): "
            )
            .strip()
            .lower()
        )

        logger_service_url = input(
            "Enter Logger Service URL, press enter for default (http://localhost:8090): ").strip() or "http://localhost:8090"

        if enable_rabbitmq_log:
            rabbitmq_logging_hostname = input(
                "Enter RabbitMQ Logging Host, press enter for default (localhost): "
            ).strip() or "localhost"
        else:
            rabbitmq_logging_hostname = ""

        logger_config_file_path = os.path.join(config_folder, "logging.json")

        with open(logger_config_file_path, "r") as file:
            data = json.load(file)

        data["local"].update(
            {
                "enable_file_logs": enable_file_log,
                "enable_http_post_logs": enable_http_log,
                "enable_rabbitmq_logs": enable_rabbitmq_log,
                "logger_service_url": logger_service_url,
                "rabbitmq_logging_hostname": rabbitmq_logging_hostname or "DISABLED",
            }
        )

        with open(logger_config_file_path, "w") as file:
            json.dump(data, file, indent=4)

    def configure_agent(self):
        """
        Configures the agent using the given configuration file.
        """
        dir_path = os.path.dirname(os.path.realpath(__file__))
        config_folder = os.path.join(dir_path, "config")
        self.configure_message_queue(config_folder)
        self.configure_logger(config_folder)
        self.view_configuration()

    def view_configuration(self):
        """
        View the configuration file

        Args:
            config_file (str): Path of config file
        """
        dir_path = os.path.dirname(os.path.realpath(__file__))
        config_folder = os.path.join(dir_path, "config")

        messaging_config_file_path = os.path.join(config_folder, "messaging.json")
        logger_config_file_path = os.path.join(config_folder, "logging.json")

        run_env = os.getenv("AGENT_RUN_ENV", "local")

        def print_dict(d, indent=0):
            for key, value in d.items():
                if isinstance(value, dict):
                    print("    " * indent + f"{key}:")
                    print_dict(value, indent + 1)
                else:
                    print("    " * indent + f"{key}: {value}")

        print("\n*********************************")
        print("***** Current Configuration *****")
        print("*********************************")
        print(f"\nMessaging Configuration ({run_env}):")
        with open(messaging_config_file_path, "r") as file:
            data = json.load(file)
            if "rabbitmq" in data and run_env in data["rabbitmq"]:
                print_dict(data["rabbitmq"][run_env])
            else:
                print("No local messaging configuration found.")

        print(f"\nLogger Configuration ({run_env}):")
        with open(logger_config_file_path, "r") as file:
            data = json.load(file)
            if run_env in data:
                print_dict(data[run_env])
            else:
                print("No local logger configuration found.")
        print("\n*********************************")
