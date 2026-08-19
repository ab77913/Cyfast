from dataclasses import dataclass, field
import enum
import platform
import socket


import enum


class SupportedAgentPlugins(enum.Enum):
    """
    Enum for supported agent plugins.

    Args:
        ROBOT (int): Represents the Robot Framework plugin.
        PYTEST (int): Represents the Pytest plugin.
        CAPL (int): Represents the CAPL plugin.
        SPECFLOW (int): Represents the SpecFlow plugin.
    """
    ROBOT = 0
    PYTEST = 1
    CAPL = 2
    SPECFLOW = 3


class TestcaseSourceType(enum.Enum):
    """
    Enum for source types of test cases.

    Args:
        REPOSITORY (int): Represents a repository source type.
        SHARED_DIRECTORY (int): Represents a shared directory source type.
        LOCAL_DIRECTORY (int): Represents a local directory source type.
    """
    REPOSITORY = 0
    SHARED_DIRECTORY = 1
    LOCAL_DIRECTORY = 2


class ExecutionBase(enum.Enum):
    """
    Enum for execution base types.

    Args:
        TEST_CASE (str): Represents a test case execution.
        TEST_SCRIPT (str): Represents a test script execution.
    """
    TEST_CASE = "TEST_CASE"
    TEST_SCRIPT = "TEST_SCRIPT"


@dataclass
class SupportedExecutionBase:
    """
    A data class to represent the supported execution bases for different testing frameworks.

    Args:
        ROBOT (list): Supported execution bases for the Robot Framework, defaulting to both TEST_CASE and TEST_SCRIPT.
        PYTEST (list): Supported execution bases for Pytest, defaulting to both TEST_CASE and TEST_SCRIPT.
        CAPL (list): Supported execution bases for CAPL, defaulting to TEST_SCRIPT.
        SPECFLOW (list): Supported execution bases for SpecFlow, defaulting to TEST_CASE.
    """

    ROBOT: list = field(default_factory=lambda: [
                        ExecutionBase.TEST_CASE.name, ExecutionBase.TEST_SCRIPT.name])
    PYTEST: list = field(default_factory=lambda: [
                         ExecutionBase.TEST_CASE.name, ExecutionBase.TEST_SCRIPT.name])
    CAPL: list = field(default_factory=lambda: [
                       ExecutionBase.TEST_SCRIPT.name])
    SPECFLOW: list = field(default_factory=lambda: [
        ExecutionBase.TEST_CASE.name])


class ExecutionMode(enum.Enum):
    """
    Enum for execution mode types.

    Args:
        SEQUENTIAL (str): Represents a sequential execution.
        DISTRIBUTED (str): Represents a distributed execution.
        SEQUENTIAL_DEPENDENCY (str): Represents a sequential dependency execution.
    """
    SEQUENTIAL = "SEQUENTIAL"
    DISTRIBUTED = "DISTRIBUTED"
    SEQUENTIAL_DEPENDENCY = "SEQUENTIAL_DEPENDENCY"


@ dataclass
class SupportedExecutionMode:
    """
    A data class to represent the supported execution modes for different testing frameworks.

    Args:
        ROBOT (list): Supported execution modes for the Robot Framework.
        PYTEST (list): Supported execution modes for Pytest.
        CAPL (list): Supported execution modes for CAPL.
        SPECFLOW (list): Supported execution modes for SpecFlow.
    """
    ROBOT: list = field(default_factory=lambda: [
        ExecutionMode.SEQUENTIAL.name, ExecutionMode.DISTRIBUTED.name, ExecutionMode.SEQUENTIAL_DEPENDENCY.name])
    PYTEST: list = field(default_factory=lambda: [
        ExecutionMode.SEQUENTIAL.name, ExecutionMode.DISTRIBUTED.name, ExecutionMode.SEQUENTIAL_DEPENDENCY.name])
    CAPL: list = field(default_factory=lambda: [
        ExecutionMode.SEQUENTIAL.name, ExecutionMode.SEQUENTIAL_DEPENDENCY.name])
    SPECFLOW: list = field(default_factory=lambda: [
        ExecutionMode.SEQUENTIAL.name])


class AgentStatus(enum.Enum):
    """
    Enum for status types of test agent.

    Args:
        REGISTERED (int): Represents the Agent Registered state.
        REGISTERING (int): Represents the state where the agent is in the process of registering.
        READY (int): Represents the state where the agent is ready and waiting for engine.
        RUNNING (int): Represents the state where the agent is currently executing tests.
        PAUSED (int): Represents the state where the agent is paused and not currently executing tests.
        REPORTING (int): Represents the state where the agent is reporting the test results.
        DEAD (int): Represents the state where the agent has encountered a fatal error or is no longer functional.
        RESTARTING (int): Represents the state where the agent is in the process of restarting.
        PARSING (int): Represents the state where the agent is parsing test cases or input.
        EXITED (int): Represents the state where the agent has exited and is no longer running.
        SUSPENDED (int): Represents the state where the agent is suspended, typically temporarily halted.
        UNKNOWN (int): Represents an unknown state of the agent.
    """
    REGISTERED = 0
    REGISTERING = 1
    READY = 2
    RUNNING = 3
    PAUSED = 4
    REPORTING = 5
    DEAD = 6
    RESTARTING = 7
    PARSING = 8
    EXITED = 9
    SUSPENDED = 10
    UNKNOWN = 11


@ dataclass
class HostInfo():
    """
    Represents information about the host system.

    Args:
        name (str): The hostname of the host.
        os (str): The operating system name of the host.
    """
    name: str = socket.gethostname()
    os: str = platform.system()


@ dataclass
class TestAgentRegisterInfo():
    """
    Represents registration information for a test agent.

    Args:
        agent_name (str): The name of the agent.
        agent_id (int): The ID of the agent.
        timestamp (str): The timestamp of registration.
        mode (list): The mode of operation.(Executor, Parser or both)
        host (HostInfo): Information about the host system.
        agent_type (str): The type of the agent.
        status (str): The status of the agent.
        supported_execution_mode (list): List of supported execution modes.
        supported_execution_base (list): List of supported execution bases.
    """
    agent_name: str = field(default_factory=str)
    agent_id: int = field(default=0)
    timestamp: str = field(default="")
    mode: list = field(default_factory=list)
    host: HostInfo = field(default_factory=dict)
    agent_type: str = field(default_factory=str)
    status: str = field(default_factory=str)
    supported_execution_mode: list = field(default_factory=list)
    supported_execution_base: list = field(default_factory=list)


class AgentMode(enum.Enum):
    """
    Enum representing modes of operation for an agent.

    Args:
        EXECUTOR (int): Represents the executor mode of the agent.
        PARSER (int): Represents the parser mode of the agent.
    """
    EXECUTOR = 0
    PARSER = 1


class AgentInfo:
    """
    Singleton class for managing agent information.
    """
    _instance = None
    _agent = None

    def __new__(cls, *args, **kwargs):
        """
        Create a new instance of AgentInfo if it doesn't exist already.

        Args:
            *args: Positional arguments to initialize the TestAgentRegisterInfo.
            **kwargs: Keyword arguments to initialize the TestAgentRegisterInfo.

        Returns:
            AgentInfo: The singleton instance of AgentInfo.

        Raises:
            ValueError: If no initial agent instance or arguments are provided.
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            if args or kwargs:
                cls._instance._agent = TestAgentRegisterInfo(*args, **kwargs)
            else:
                raise ValueError(
                    "An initial Agent instance or arguments must be provided.")

        return cls._instance

    @ property
    def agent(self):
        """
        Get the TestAgentRegisterInfo instance.

        Returns:
            TestAgentRegisterInfo: The agent information.
        """
        return self._agent

    @ property
    def name(self):
        """
        Get the name of the agent.

        Returns:
            str: The name of the agent.
        """
        return str(self._agent.agent_name)

    @ property
    def uuid(self):
        """
        Get the UUID of the agent.

        Returns:
            str: The UUID of the agent.
        """
        return str(self._agent.agent_id)

    @ uuid.setter
    def uuid(self, value):
        """
        Set the UUID of the agent.

        Args:
            value (str): The UUID value to set.
        """
        self._agent.agent_id = value

    @ property
    def timestamp(self):
        """
        Get the timestamp of the agent.

        Returns:
            str: The timestamp of the agent.
        """
        return str(self._agent.timestamp)

    @ property
    def mode(self):
        """
        Get the mode of the agent.

        Returns:
            str: The mode of the agent.
        """
        return str(self._agent.mode)

    @ property
    def host(self):
        """
        Get the host of the agent.

        Returns:
            str: The host of the agent.
        """
        return str(self._agent.host)

    @ property
    def agent_type(self):
        """
        Get the type of the agent.

        Returns:
            str: The type of the agent.
        """
        return str(self._agent.agent_type)

    @ property
    def status(self):
        """
        Get the status of the agent.

        Returns:
            str: The status of the agent.
        """
        return str(self._agent.status)

    @ status.setter
    def status(self, value):
        """
        Set the status of the agent.

        Args:
            value (str): The status value to set.
        """
        self._agent.status = value
