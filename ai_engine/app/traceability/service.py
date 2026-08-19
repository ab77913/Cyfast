from typing import Any

from pydantic import BaseModel, Field

from app.shared.llm import (
    LLMConfigurationError,
    LLMTransportError,
    chat_completion_json,
    llm_setup_hint,
    resolved_chat_model,
)
from app.shared.llm_profiles import LLMProfile
from app.shared.prompt_loader import load_prompt

_TR = LLMProfile.TRACEABILITY


class TraceabilityAnalyzeBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirements_json: str = Field(
        ...,
        description="JSON or text listing requirement ids and titles/descriptions.",
    )
    artifacts_json: str = Field(
        ...,
        description="JSON or text listing tests, risks, or other trace targets.",
    )


class TraceabilityGenerateBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirements_json: str = Field(...)
    artifacts_json: str = Field(...)
    goal: str = Field(
        default="Suggest missing trace links and justify each briefly.",
        min_length=1,
    )


async def analyze_traceability(body: TraceabilityAnalyzeBody) -> dict[str, Any]:
    system_prompt = load_prompt("system/traceability_analyze.txt")
    user_template = load_prompt("user/traceability_analyze.txt")
    user_payload = user_template.format(
        project_id=body.project_id,
        requirements_json=body.requirements_json,
        artifacts_json=body.artifacts_json,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(messages=messages, temperature=0.1, profile=_TR)
    except LLMConfigurationError:
        return {
            "status": "llm_unavailable",
            "model": resolved_chat_model(_TR),
            "links": [],
            "message": llm_setup_hint(),
        }
    except LLMTransportError as e:
        return {
            "status": "llm_unreachable",
            "model": resolved_chat_model(_TR),
            "links": [],
            "message": str(e),
        }
    except RuntimeError as e:
        return {
            "status": "llm_bad_response",
            "model": resolved_chat_model(_TR),
            "links": [],
            "message": str(e),
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_TR),
        "project_id": body.project_id,
        **data,
    }


async def generate_traceability(body: TraceabilityGenerateBody) -> dict[str, Any]:
    system_prompt = load_prompt("system/traceability_generate.txt")
    user_template = load_prompt("user/traceability_generate.txt")
    user_payload = user_template.format(
        project_id=body.project_id,
        goal=body.goal,
        requirements_json=body.requirements_json,
        artifacts_json=body.artifacts_json,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(messages=messages, temperature=0.25, profile=_TR)
    except LLMConfigurationError:
        return {
            "status": "llm_unavailable",
            "model": resolved_chat_model(_TR),
            "suggested_links": [],
            "message": llm_setup_hint(),
        }
    except LLMTransportError as e:
        return {
            "status": "llm_unreachable",
            "model": resolved_chat_model(_TR),
            "suggested_links": [],
            "message": str(e),
        }
    except RuntimeError as e:
        return {
            "status": "llm_bad_response",
            "model": resolved_chat_model(_TR),
            "suggested_links": [],
            "message": str(e),
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_TR),
        "project_id": body.project_id,
        **data,
    }
