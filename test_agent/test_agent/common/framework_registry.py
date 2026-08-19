import importlib
from test_agent.common.test_agent_dto import AgentInfo


module_map = {
    "ROBOT": ("test_agent.plugins.robot_plugin.robot_executor", "RobotFramework", "test_agent.plugins.robot_plugin.robot_parser", "RobotParser"),
    "PYTEST": ("test_agent.plugins.pytest_plugin.pytest_executor", "PytestFramework", "test_agent.plugins.pytest_plugin.pytest_parser", "PyTestParser"),
    "SPECFLOW": ("test_agent.plugins.specflow_plugin.specflow_executor", "SpecFlowFramework", "test_agent.plugins.specflow_plugin.specflow_parser", "SpecflowParser"),
    "CAPL": ("test_agent.plugins.capl_plugin.capl_executor", "CAPLFramework", "test_agent.plugins.capl_plugin.capl_parser", "CAPLParser"),
}


def get_framework_executor_class(agent_type):
    try:
        module_name, class_name, _, _ = module_map[agent_type]
        module = importlib.import_module(module_name)
        return getattr(module, class_name)      
    except KeyError:
        raise ValueError(f"Unsupported framework: {agent_type}")


def get_framework_parser_class(agent_type):
    try:
        _, _, module_name, class_name = module_map[agent_type]
        module = importlib.import_module(module_name)
        return getattr(module, class_name)      
    except KeyError:
        raise ValueError(f"Unsupported framework: {agent_type}")