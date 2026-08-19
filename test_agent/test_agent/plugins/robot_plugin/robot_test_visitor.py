from robot.api import ResultVisitor
from datetime import datetime


class RobotTestVisitor(ResultVisitor):
    """
    Test visitor for Robot plugin
    This class extends robot framework's ResultVisitor class
    Args:
        test_list (list):   List to store the test case wise execution details
    """

    def __init__(self, test_list):
        self.test_list = test_list

    def visit_test(self, test):
        """
        Get result details. Executed for each test case.
        Implements traversing through tests.

        Args:
            test (obj): Test attributes
        """
        data = {"file_name": test.source.name,
                "test_name": test.name,
                "test_status":  {"PASS": "PASSED", "SKIP": "SKIPPED", "FAIL": "FAILED"}.get(test.status, "FAILED"),
                "test_start_time": datetime.strptime(test.starttime, "%Y%m%d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S"),
                "test_end_time": datetime.strptime(test.endtime, "%Y%m%d %H:%M:%S.%f").strftime("%Y-%m-%d %H:%M:%S"),
                "test_elapsed_time": test.elapsedtime/float(1000),
                "test_message": test.message}
        self.test_list.append(data)
