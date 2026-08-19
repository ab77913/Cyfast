"""Orchestration for test script generate / regenerate."""

from __future__ import annotations

import re

from app.test_scripts.constants import SUPPORTED_FRAMEWORKS
from app.test_scripts.context_builder import build_context
from app.test_scripts.llm_ops import (
    llm_generate_plan,
    llm_generate_script,
    llm_regenerate_script,
    llm_regenerate_with_messages,
)
from app.test_scripts.schemas import GenerateRequest, GenerateResponse, RegenerateRequest
from app.test_scripts.session_store import (
    append_turn,
    create_session,
    get_last_assistant_content,
    get_messages_for_llm,
    get_session,
)


def parse_test_steps(plan_response: str) -> list[str]:
    """Parse LLM plan response into list of step strings."""
    if not plan_response or not plan_response.strip():
        return []
    steps = []
    for line in plan_response.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^(?:\d+\.|Step\s+\d+:)\s*(.+)", line, re.IGNORECASE)
        if match:
            steps.append(match.group(1).strip())
        elif re.match(r"^\d+\s", line):
            steps.append(re.sub(r"^\d+\s*", "", line).strip())
        else:
            steps.append(line)
    return steps


async def generate_test_script_flow(request: GenerateRequest) -> GenerateResponse:
    if request.framework not in SUPPORTED_FRAMEWORKS:
        raise ValueError(
            f"Unsupported framework. Use one of: {', '.join(sorted(SUPPORTED_FRAMEWORKS))}"
        )

    context = build_context(request)

    plan_response = await llm_generate_plan(
        project_description=context["project_description"],
        requirements=context["requirements"],
        test_scenario=context["test_scenario"],
    )
    test_steps = parse_test_steps(plan_response)
    if not test_steps and plan_response:
        test_steps = [
            line.strip()
            for line in plan_response.strip().split("\n")
            if line.strip()
        ]

    generated_script = await llm_generate_script(
        project_description=context["project_description"],
        requirements=context["requirements"],
        test_scenario=context["test_scenario"],
        test_steps=test_steps,
        framework=context["framework"],
        directory_summary=context["directory_summary"],
        example_script=context["example_script"],
    )

    if not generated_script:
        return GenerateResponse(
            test_steps=test_steps,
            generated_script="",
            status="partial",
        )

    session_id = create_session(
        metadata={
            "framework": context["framework"],
            "project_description": context["project_description"],
            "requirements": context["requirements"],
            "test_scenario": context["test_scenario"],
            "test_steps": test_steps,
        },
        initial_assistant_content=generated_script,
    )

    return GenerateResponse(
        test_steps=test_steps,
        generated_script=generated_script,
        status="success",
        session_id=session_id,
    )


async def regenerate_test_script_flow(request: RegenerateRequest) -> GenerateResponse:
    fw = request.framework
    if fw and fw not in SUPPORTED_FRAMEWORKS:
        raise ValueError(
            f"Unsupported framework. Use one of: {', '.join(sorted(SUPPORTED_FRAMEWORKS))}"
        )

    if request.session_id:
        session = get_session(request.session_id)
        if not session:
            raise LookupError("Session not found or expired")
        messages = get_messages_for_llm(
            session_id=request.session_id,
            user_comments=request.user_comments,
            framework=request.framework or "selenium_pytest",
        )
        improved_script = await llm_regenerate_with_messages(messages)
        if improved_script:
            append_turn(
                session_id=request.session_id,
                user_content=request.user_comments,
                assistant_content=improved_script,
            )
        current = improved_script or get_last_assistant_content(request.session_id)
        return GenerateResponse(
            test_steps=[],
            generated_script=current,
            status="success" if improved_script else "partial",
            session_id=request.session_id,
        )

    improved_script = await llm_regenerate_script(
        current_script=request.current_script or "",
        user_comments=request.user_comments,
        framework=request.framework or "selenium_pytest",
        project_description=request.project_description or "",
        requirements=request.requirements or "",
        test_scenario=request.test_scenario or "",
    )
    current = improved_script or request.current_script or ""
    return GenerateResponse(
        test_steps=[],
        generated_script=current,
        status="success" if improved_script else "partial",
        session_id=None,
    )
