"""Build prompts for planning and script generation."""


def build_plan_prompt(
    project_description: str,
    requirements: str,
    test_scenario: str,
) -> str:
    """Build the prompt for phase 1: planning test steps."""
    return f"""Given the following project description, requirements, and test scenario, list the concrete test steps as a numbered list. Output only the steps, one per line, like "1. Step description".

Project description: {project_description}

Requirements: {requirements}

Test scenario: {test_scenario}

List the test steps:"""


def build_script_system_prompt(framework: str = "selenium_pytest") -> str:
    """Build the system prompt for script generation."""
    base = """You are an expert test automation engineer. Generate valid, executable test code that:
- Matches the specified framework and existing project patterns
- Uses Page Object Model when applicable (for Python frameworks)
- Output ONLY the code, no markdown code blocks or extra commentary"""
    if framework == "robot_framework":
        return base + "\n- Use Robot Framework .robot syntax with appropriate keywords and structure"
    return base + "\n- Follow PEP 8 style\n- Include necessary imports and fixtures"


def build_script_user_prompt(
    project_description: str,
    requirements: str,
    test_scenario: str,
    test_steps: list[str],
    framework: str,
    directory_summary: str = "",
    example_script: str = "",
) -> str:
    """Build the user prompt for phase 2: script generation."""
    steps_text = "\n".join(test_steps) if test_steps else "Not specified."

    context_parts = [
        f"Project description: {project_description}",
        f"Requirements: {requirements}",
        f"Test scenario: {test_scenario}",
        f"Planned test steps:\n{steps_text}",
        f"Target framework: {framework}",
    ]
    if directory_summary:
        context_parts.append(
            f"Existing test structure (follow these patterns):\n{directory_summary}"
        )
    if example_script:
        context_parts.append(f"Example script to follow:\n```python\n{example_script}\n```")

    content = "\n\n".join(context_parts)
    if framework == "robot_framework":
        content += "\n\nGenerate a complete Robot Framework test in .robot format. Output only the .robot file content, no markdown fences or explanation."
    else:
        content += "\n\nGenerate a complete, executable test automation script in Python. Output only the Python code, no markdown fences or explanation."
    return content


def build_regenerate_system_prompt(framework: str = "selenium_pytest") -> str:
    """Build the system prompt for script regeneration based on user feedback."""
    base = """You are an expert test automation engineer. The user has received a generated test script and has provided feedback.
Your task is to revise the script to address their comments. Preserve what works, fix what doesn't, and add what's missing.
Output ONLY the revised code, no markdown code blocks or extra commentary."""
    if framework == "robot_framework":
        return base + "\n- Maintain Robot Framework .robot syntax"
    return base + "\n- Follow PEP 8 style\n- Keep necessary imports and fixtures"


def build_regenerate_user_prompt(
    current_script: str,
    user_comments: str,
    framework: str = "selenium_pytest",
    project_description: str = "",
    requirements: str = "",
    test_scenario: str = "",
) -> str:
    """Build the user prompt for script regeneration."""
    parts = [
        "Current script to improve:",
        "```",
        current_script.strip(),
        "```",
        "",
        "User feedback (address these points):",
        user_comments.strip(),
    ]
    if project_description or requirements or test_scenario:
        extras = []
        if project_description:
            extras.append(f"Project: {project_description}")
        if requirements:
            extras.append(f"Requirements: {requirements}")
        if test_scenario:
            extras.append(f"Test scenario: {test_scenario}")
        parts.extend(["", "Additional context:", "\n".join(extras)])
    parts.extend(["", f"Framework: {framework or 'selenium_pytest'}", "", "Produce the improved, complete script. Output only the code."])
    return "\n".join(parts)
