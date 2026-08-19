import os
import time
import xml.etree.cElementTree as ET
from datetime import datetime, timedelta


class SpecflowTestListener:
    """
    Test Listener for the Specflow plugin

    Args:
      msg_builder (MessageBuilder): Message builder to build message payload
      publisher (Publisher):  Publisher to publish messages
      logger (LoggerService.logger):  Logger to log messages
    """

    def __init__(self, msg_builder, publisher, logger, pause_execution_event) -> None:
        self.test_execution_result_details = []
        self.msg_builder = msg_builder
        self.publisher = publisher
        self.logger = logger
        self.pause_execution_event = pause_execution_event

    def start_of_test(self, test_name):
        """
        Executed at the test start

        Args:
            test_name (str): Name of the test case
        """
        try:
            message_to_publish = self.msg_builder.build_test_status_message(
                test_name, "", "INPROGRESS"
            )
            self.publisher.publish_test_status(message_to_publish)
            while self.pause_execution_event.is_set():
                time.sleep(0.5)
                if self.stop_execution_event.is_set():
                    break

        except Exception as e:
            self.logger.error(e)

    def end_of_test(self, file_name, test_name, report_path):
        """
        Executed at the test end

        Args:
            file_name (str): Name of the test file
            test_name (str): Name of the test case
            report_path (str): Directory path for the report
        """
        try:
            result_dict = {
                "start_time": "",
                "end_time": "",
                "duration": "",
                "outcome": "",
            }
            tree = ET.parse(report_path)
            root = tree.getroot()
            namespace = root.tag.replace("TestRun", "")
            for results in root.findall(namespace + "Results"):
                for unit_result in results.findall(namespace + "UnitTestResult"):
                    result_dict.update(
                        {
                            "start_time": self.convert_timestamp(
                                unit_result.get("startTime")
                            ),
                            "end_time": self.convert_timestamp(
                                unit_result.get("endTime")
                            ),
                            "duration": self.convert_duration_to_seconds(
                                unit_result.get("duration")
                            ),
                            "outcome": unit_result.get("outcome").upper(),
                            "message": unit_result.find(
                                namespace
                                + "Output/"
                                + namespace
                                + "ErrorInfo/"
                                + namespace
                                + "Message"
                            ).text,
                        }
                    )
            message_to_publish = self.msg_builder.build_test_status_message(
                test_name,
                "",
                result_dict.get("outcome"),
                result_dict.get("start_time"),
                result_dict.get("end_time"),
                result_dict.get("duration"),
            )
            self.publisher.publish_test_status(message_to_publish)
            self.test_execution_result_details.append(
                {
                    "file_name": file_name,
                    "test_name": test_name,
                    "test_status": result_dict.get("outcome"),
                    "test_message": result_dict.get("message"),
                    "test_start_time": result_dict.get("start_time"),
                    "test_end_time": result_dict.get("end_time"),
                    "test_elapsed_time": result_dict.get("duration"),
                }
            )
        except Exception as e:
            self.logger.error(e)

    def get_test_execution_result_details(self):
        """
        Get the test execution result details list

        Returns:
            list: Test execution result details
        """
        return self.test_execution_result_details

    def convert_timestamp(self, timestamp):
        """
        Format the timestamp

        Args:
            timestamp (str): Timestamp string

        Returns:
            str: Timestamp formatted as YYYY-MM-DD HH:MM:SS
        """
        try:
            timestamp_parts = timestamp.split("+")
            timestamp_without_microseconds = timestamp_parts[0].rsplit(".", 1)[0]
            dt_object = datetime.strptime(
                timestamp_without_microseconds, "%Y-%m-%dT%H:%M:%S"
            )
            formatted_timestamp = dt_object.strftime("%Y-%m-%d %H:%M:%S")
            return formatted_timestamp
        except Exception as e:
            self.logger.error(e)
            return ""

    def convert_duration_to_seconds(self, timestamp):
        """
        Convert the duration value to seconds

        Args:
            timestamp (str): Timestamp string

        Returns:
            str: Time in Seconds
        """
        try:
            hours, minutes, rest = timestamp.split(":")
            seconds, microseconds = rest.split(".")
            hours = int(hours)
            minutes = int(minutes)
            seconds = int(seconds)
            microseconds = int(microseconds)
            total_seconds = hours * 3600 + minutes * 60 + seconds + microseconds / 1e6
            return str(total_seconds)
        except Exception as e:
            self.logger.error(e)
            return ""
