import time
from datetime import datetime


class RobotListener:
    """
    Test Listener for the Robot plugin

    Args:
      msg_builder (MessageBuilder): Message builder to build message payload
      publisher (Publisher):  Publisher to publish messages
      ROBOT_LISTENER_API_VERSION (int): API version of the Robot listener 
      MAX_VARIABLE_VALUE_TEXT_LENGTH (int): Maximum value of text length of a variable
    """
    ROBOT_LISTENER_API_VERSION = 2
    MAX_VARIABLE_VALUE_TEXT_LENGTH = 2048

    def __init__(self, msg_builder, publisher, stop_execution_event, pause_execution_event, on_error_abort=False) -> None:
        self.msg_builder = msg_builder
        self.publisher = publisher
        self.stop_execution_event = stop_execution_event
        self.pause_execution_event = pause_execution_event
        self.on_error_abort = on_error_abort

    def wait_to_resume(self, name, attrs):
        """
        Wait handler for tests until resumed

        Args:
            name (str): Name of the test case
            attrs (obj): Test attributes
        """
        tags = attrs.get("tags", "")
        test_id = next((tag for tag in tags if tag.startswith("TC")), "")
        message_to_publish = self.msg_builder.build_test_status_message(
            name, test_id, "PAUSED")
        self.publisher.publish_test_status(message_to_publish)

        orch_status_message = self.msg_builder.build_execution_status_message(
            "PAUSED")
        self.publisher.publish_execution_status(orch_status_message)

        while self.pause_execution_event.is_set():
            time.sleep(0.5)
            if self.stop_execution_event.is_set():
                raise SystemExit("EXECUTION ABORTED BY USER")

        message_to_publish = self.msg_builder.build_test_status_message(
            name, test_id, "INPROGRESS")
        self.publisher.publish_test_status(message_to_publish)

        orch_status_message = self.msg_builder.build_execution_status_message(
            "INPROGRESS")
        self.publisher.publish_execution_status(orch_status_message)

    def start_test(self, name, attrs):
        """
        Executed at the test start

        Args:
            name (str): Name of the test case
            attrs (obj): Test attributes 
        """
        tags = attrs.get("tags", "")
        test_id = next((tag for tag in tags if tag.startswith("TC")), "")
        message_to_publish = self.msg_builder.build_test_status_message(
            name, test_id, "INPROGRESS")
        self.publisher.publish_test_status(message_to_publish)

        orch_status_message = self.msg_builder.build_execution_status_message(
            "INPROGRESS")
        self.publisher.publish_execution_status(orch_status_message)

    def end_test(self, name, attrs):
        """
        Executed at the test end

        Args:
            name (str): Name of the test case
            attrs (obj): Test attributes 
        """
        name = attrs.get("originalname", "")
        status = {"PASS": "PASSED", "SKIP": "SKIPPED"}.get(
            attrs.get("status", ""), "FAILED")
        tags = attrs.get("tags", "")
        test_id = next((tag for tag in tags if tag.startswith("TC")), "")
        start_time_stamp = datetime.strptime(attrs.get("starttime", datetime.now().strftime(
            '%Y%m%d %H:%M:%S.%f')), "%Y%m%d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S")
        end_time_stamp = datetime.strptime(attrs.get("endtime", datetime.now().strftime(
            '%Y%m%d %H:%M:%S.%f')), "%Y%m%d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S")
        message_to_publish = self.msg_builder.build_test_status_message(
            name, test_id, status, start_time_stamp, end_time_stamp, attrs.get("elapsedtime", 0)/float(1000))
        self.publisher.publish_test_status(message_to_publish)
        if self.on_error_abort and status == "FAILED":
            orch_status_message = self.msg_builder.build_execution_status_message(
                "ABORTED")
            self.publisher.publish_execution_status(orch_status_message)
            raise SystemExit("EXECUTION ABORTED DUE TO TEST FAILURE, ON_ERROR_ABORT IS ENABLED")




    def start_suite(self, name, attrs):
        """
        Executed at the suite start

        Args:
            name (str): Name of the test suite
            attrs (obj): Suite attributes 
        """
        self.send_console_log()

    def end_suite(self, name, attrs):
        """
        Executed at the suite end

        Args:
            name (str): Name of the test suite
            attrs (obj): Suite attributes 
        """
        self.send_console_log()

    def start_keyword(self, name, attrs):
        """
        Executed at start of the keyword

        Args:
            name (str): Name of the test suite
            attrs (obj): Suite attributes 
        """
        if self.stop_execution_event.is_set():
            raise SystemExit("EXECUTION ABORTED BY USER")
        if self.pause_execution_event.is_set():
            self.wait_to_resume(name, attrs)
        self.send_console_log()

    def close(self):
        """
        Executed at the test closure
        """
        self.send_console_log()

    def send_console_log(self):
        """
        Publish console log to the front end
        """
        message_to_publish = self.msg_builder.build_console_log_message()
        if message_to_publish:
            self.publisher.publish_console_log(message_to_publish)
