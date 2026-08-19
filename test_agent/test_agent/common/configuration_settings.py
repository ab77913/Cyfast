class ConfigurationSettings:
    """
    Class to store runtime configurations of the test agent plugins.

    Attributes:
        user_id (str or None): ID of the user.
        project_id (str or None): ID of the project.
         
        on_error_abort (bool or None): Flag to determine whether to abort on error.
        directory_path (str or None): Path to the working directory.
        suite_name (str or None): Name of the test suite.
        execution_id (str or None): ID of the orchestration execution.
        agent_name (str or None): Name of the agent.
        agent_id (str or None): ID of the agent.
        agent_type (str or None): Type of the agent.
        agent_current_working_dir (str or None): Current working directory of the agent.
        stop_flag (bool or None): Flag to indicate whether the execution should stop.
        pause_flag (bool or None): Flag to indicate whether the execution should pause.
        out_dir (str or None): Output directory path.
        agent_dir (str or None): Directory of the agent.
        merge_dir (str or None): Directory for merging files.
        test_case_reports_dir (str or None): Directory for storing test case reports.
        test_script_reports_dir (str or None): Directory for storing test script reports.
        generated_result_list (list): List of generated results.
        received_test_list (list): List of received tests.
        delimeter (str): Delimiter used in processing, default is "$__$".
        test_execution_base (str or None): Base path for test execution.
        selected_test_cases (list): List of selected test cases.
        dir_creation_timestamp (str or None): Timestamp of directory creation.
    """

    def __init__(self) -> None:
        self.user_id = None
        self.project_id = None
        
        self.on_error_abort = None
        self.directory_path = None
        self.suite_name = None
        self.execution_id = None
        self.execution_type = None
        self.agent_name = None
        self.agent_id = None
        self.agent_type = None
        self.agent_current_working_dir = None
        self.stop_flag = None
        self.pause_flag = None
        self.out_dir = None
        self.agent_dir = None
        self.merge_dir = None
        self.test_case_reports_dir = None
        self.test_script_reports_dir = None
        self.generated_result_list = []
        self.received_test_list = []
        self.delimeter = "$__$"
        self.test_execution_base = None
        self.selected_test_cases = []
        self.dir_creation_timestamp = None
