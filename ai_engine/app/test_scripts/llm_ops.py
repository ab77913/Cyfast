"""Async LLM calls for planning and script generation (OpenAI or Ollama via ``app.shared.llm``)."""

from __future__ import annotations

from app.shared.llm import chat_completion
from app.shared.llm_profiles import LLMProfile
from app.test_scripts.prompt_builder import (
    build_plan_prompt,
    build_regenerate_system_prompt,
    build_regenerate_user_prompt,
    build_script_system_prompt,
    build_script_user_prompt,
)

_TS = LLMProfile.TEST_SCRIPTS


def strip_markdown_code_fence(content: str) -> str:
    content = content.strip()
    if not content.startswith("```"):
        return content
    lines = content.split("\n")
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


async def llm_generate_plan(
    *,
    project_description: str,
    requirements: str,
    test_scenario: str,
) -> str:
    prompt = build_plan_prompt(project_description, requirements, test_scenario)
    content = await chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        json_object=False,
        profile=_TS,
    )
    return content.strip() if content else ""


async def llm_generate_script(
    *,
    project_description: str,
    requirements: str,
    test_scenario: str,
    test_steps: list[str],
    framework: str,
    directory_summary: str = "",
    example_script: str = "",
) -> str:
    system_prompt = build_script_system_prompt(framework=framework)
    user_content = build_script_user_prompt(
        project_description=project_description,
        requirements=requirements,
        test_scenario=test_scenario,
        test_steps=test_steps,
        framework=framework,
        directory_summary=directory_summary,
        example_script=example_script,
    )
    content = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        json_object=False,
        profile=_TS,
    )
    return strip_markdown_code_fence(content) if content else ""


async def llm_regenerate_script(
    *,
    current_script: str,
    user_comments: str,
    framework: str = "selenium_pytest",
    project_description: str = "",
    requirements: str = "",
    test_scenario: str = "",
) -> str:
    framework = framework or "selenium_pytest"
    system_prompt = build_regenerate_system_prompt(framework=framework)
    user_content = build_regenerate_user_prompt(
        current_script=current_script,
        user_comments=user_comments,
        framework=framework,
        project_description=project_description or "",
        requirements=requirements or "",
        test_scenario=test_scenario or "",
    )
    content = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        json_object=False,
        profile=_TS,
    )
    return strip_markdown_code_fence(content) if content else ""


async def llm_regenerate_with_messages(messages: list[dict[str, str]]) -> str:
    content = await chat_completion(
        messages=messages,
        temperature=0.2,
        json_object=False,
        profile=_TS,
    )
    return strip_markdown_code_fence(content) if content else ""
