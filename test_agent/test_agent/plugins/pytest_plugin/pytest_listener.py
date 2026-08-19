import time
import datetime
import re


class PytestListener:
    """
    Test Listener for the PyTest plugin

    Args:
      msg_builder (MessageBuilder): Message builder to build message payload
      publisher (Publisher):  Publisher to publish messages

    """

    def __init__(self, msg_builder, publisher, stop_execution_event, pause_execution_event, on_error_abort=False):
        self.test_dict = {}
        self.msg_builder = msg_builder
        self.publisher = publisher
        self.stop_execution_event = stop_execution_event
        self.pause_execution_event = pause_execution_event
        self.on_error_abort = on_error_abort

    def wait_to_resume(self, report):
        """
        Wait handler for tests until resumed

        Args:
           report (obj): Test case execution report instance
        """
        message_to_publish = self.msg_builder.build_test_status_message(re.search(
            "::([^[]+)", report.nodeid).group(1), getattr(report, "test_case_id", ""), "PAUSED")
        self.publisher.publish_test_status(message_to_publish)

        orch_status_message = self.msg_builder.build_execution_status_message(
            "PAUSED")
        self.publisher.publish_execution_status(orch_status_message)
        while self.pause_execution_event.is_set():
            time.sleep(0.5)
            if self.stop_execution_event.is_set():
                raise SystemExit("EXECUTION ABORTED BY USER")
        message_to_publish = self.msg_builder.build_test_status_message(re.search(
            "::([^[]+)", report.nodeid).group(1), getattr(report, "test_case_id", ""), "INPROGRESS")
        self.publisher.publish_test_status(message_to_publish)
        orch_status_message = self.msg_builder.build_execution_status_message(
            "INPROGRESS")
        self.publisher.publish_execution_status(orch_status_message)

    def pytest_runtest_logreport(self, report):
        """
        Pytest Hook for test status reporting

        Args:
              report (obj): Test case execution report instance
        """
        self.send_console_log()
        if self.stop_execution_event.is_set():
            raise SystemExit("EXECUTION ABORTED BY USER")
        if self.pause_execution_event.is_set():
            self.wait_to_resume(report)
        if report.when == "setup":
            self.on_test_setup(report)
        if report.when == "call":
            self.on_test_call(report)
        if report.when == "teardown":
            self.on_test_teardown(report)

    def on_test_setup(self, report):
        """
        Executes on Test setup

        Args:
           report (obj): Test case execution report instance
        """
        self.test_dict["test_case_name"] = re.search(
            "::([^[]+)", report.nodeid).group(1)
        self.test_dict["test_case_id"] = getattr(report, "test_case_id", "")
        self.test_dict["setup"] = getattr(report, "outcome", "")
        self.test_dict["test_start_time"] = getattr(report, "start", 0.0)
        message_to_publish = self.msg_builder.build_test_status_message(re.search(
            "::([^[]+)", report.nodeid).group(1), getattr(report, "test_case_id", ""), "INPROGRESS")
        self.publisher.publish_test_status(message_to_publish)

        orch_status_message = self.msg_builder.build_execution_status_message(
            "INPROGRESS")
        self.publisher.publish_execution_status(orch_status_message)
        self.send_console_log()

    def on_test_call(self, report):
        """
        Executes on Test call

        Args:
           report (obj): Test case execution report instance
        """
        print("CALL OUTCOME:", getattr(report, "outcome", ""))
        self.test_dict["call"] = getattr(report, "outcome", "")
        self.send_console_log()

    def on_test_teardown(self, report):
        """
        Executes on Test teardown

        Args:
           report (obj): Test case execution report instance
        """
        self.test_dict["teardown"] = getattr(report, "outcome", "")
        self.test_dict["test_end_time"] = getattr(report, "stop", 0.0)
        if self.on_error_abort and self.get_test_status() == "FAILED":
            orch_status_message = self.msg_builder.build_execution_status_message(
                "ABORTED")
            self.publisher.publish_execution_status(orch_status_message)
            raise SystemExit("EXECUTION ABORTED DUE TO TEST FAILURE, ON_ERROR_ABORT IS ENABLED")
        self.publish_test_status()
        self.send_console_log()

    def publish_test_status(self):
        """
        Publish real time test status message

        """
        test_case_name = self.test_dict.get("test_case_name", "")
        test_case_id = self.test_dict.get("test_case_id", "")
        test_case_status = self.get_test_status()
        test_start_time = datetime.datetime.utcfromtimestamp(
            self.test_dict.get("test_start_time", 0)).strftime("%Y-%m-%d %H:%M:%S")
        test_end_time = datetime.datetime.utcfromtimestamp(
            self.test_dict.get("test_end_time", 0)).strftime("%Y-%m-%d %H:%M:%S")
        test_elapsed_time = (datetime.datetime.utcfromtimestamp(self.test_dict.get("test_end_time", 0)) -
                             datetime.datetime.utcfromtimestamp(self.test_dict.get("test_start_time", 0))).total_seconds()
        message_to_publish = self.msg_builder.build_test_status_message(
            test_case_name, test_case_id, test_case_status, test_start_time, test_end_time, test_elapsed_time)
        self.publisher.publish_test_status(message_to_publish)

    def get_test_status(self):
        """
        Get the test status

        Returns:
            str: Test Execution status
        """
        if self.test_dict.get("setup", "") == "failed":
            return "ERROR"
        elif self.test_dict.get("setup", "") == "skipped":
            return "SKIPPED"
        elif self.test_dict.get("call", "") == "failed":
            return "FAILED"
        elif self.test_dict.get("teardown", "") == "failed":
            return "ERROR"
        else:
            return "PASSED"

    def send_console_log(self):
        """
        Publish console log to the front end
        """
        message_to_publish = self.msg_builder.build_console_log_message()
        if message_to_publish:
            self.publisher.publish_console_log(message_to_publish)
