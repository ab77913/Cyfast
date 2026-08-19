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
from app.shared.example_prompt_builder import (
    build_requirement_examples_block,
    detect_document_type_from_context,
)
from app.shared.prompt_loader import load_prompt

_REQ = LLMProfile.REQUIREMENTS


class GenerateRequirementsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    topic: str = Field(
        ...,
        min_length=1,
        description="Goal, stakeholder need, or high-level feature to expand into requirements.",
    )
    constraints: str | None = Field(
        default=None,
        description="Optional standards, regulatory notes, or non-functional limits.",
    )


async def generate_requirements(body: GenerateRequirementsBody) -> dict[str, Any]:
    system_prompt = load_prompt("system/requirement_topic.txt")
    user_template = load_prompt("user/requirement_topic.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    constraints_block = ""
    if body.constraints:
        constraints_block = f"\nCONSTRAINTS:\n{body.constraints}"
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        topic=body.topic,
        constraints_block=constraints_block,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(
            messages=messages, temperature=0.25, profile=_REQ
        )
    except LLMConfigurationError:
        return {
            "status": "llm_unavailable",
            "model": resolved_chat_model(_REQ),
            "requirements": [],
            "message": llm_setup_hint(),
        }
    except LLMTransportError as e:
        return {
            "status": "llm_unreachable",
            "model": resolved_chat_model(_REQ),
            "requirements": [],
            "message": str(e),
        }
    except RuntimeError as e:
        return {
            "status": "llm_bad_response",
            "model": resolved_chat_model(_REQ),
            "requirements": [],
            "message": str(e),
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_REQ),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        **data,
    }


class GenerateFromDocumentsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirement_categories: list[str] = Field(..., min_length=1)
    document_context: str = Field(..., min_length=10)
    source_document_ids: list[int] = Field(default_factory=list)
    additional_instructions: str | None = Field(
        default=None,
        description="Optional user-authored hints for retrieval and excerpt framing.",
    )


class RegenerateFromDocumentsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirement_categories: list[str] = Field(..., min_length=1)
    document_context: str = Field(..., min_length=10)
    prior_requirements: list[dict[str, Any]] = Field(default_factory=list)
    user_feedback: str = Field(..., min_length=1)
    additional_instructions: str | None = Field(
        default=None,
        description="Optional extraction hints persisted with the generation job.",
    )


def _extras_block(body: GenerateFromDocumentsBody | RegenerateFromDocumentsBody) -> str:
    extras = getattr(body, "additional_instructions", None)
    if extras is None or not str(extras).strip():
        return ""
    t = str(extras).strip()
    max_extra = 4000
    if len(t) > max_extra:
        t = t[: max_extra - 40] + "\n...[truncated]..."
    return f"\n\nADDITIONAL INSTRUCTIONS (apply when consistent with excerpts):\n{t}"


def _ctx(body: GenerateFromDocumentsBody | RegenerateFromDocumentsBody) -> str:
    ctx = body.document_context.strip()
    max_c = 26000
    if len(ctx) > max_c:
        return ctx[: max_c - 40] + "\n...[truncated]..."
    return ctx


def _cats_label(categories: list[str]) -> str:
    return ", ".join(str(c).strip().upper() for c in categories if str(c).strip())


def _append_examples_block(user_payload: str, body: GenerateFromDocumentsBody | RegenerateFromDocumentsBody) -> str:
    document_type = detect_document_type_from_context(_ctx(body))
    examples_block = build_requirement_examples_block(document_type)
    if not examples_block:
        return user_payload
    return f"{user_payload}\n\n{examples_block}"


def _json_error(status: str, message: str) -> dict[str, Any]:
    return {
        "status": status,
        "model": resolved_chat_model(_REQ),
        "requirements": [],
        "message": message,
    }


async def generate_requirements_from_documents(
    body: GenerateFromDocumentsBody,
) -> dict[str, Any]:
    system_prompt = load_prompt("system/requirement_generation.txt")
    user_template = load_prompt("user/requirement_generation.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        categories_label=_cats_label(body.requirement_categories),
        source_document_ids=body.source_document_ids,
        document_context=_ctx(body),
        additional_block=_extras_block(body),
    )
    user_payload = _append_examples_block(user_payload, body)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(
            messages=messages, temperature=0.2, profile=_REQ
        )
    except LLMConfigurationError:
        return {**_json_error("llm_unavailable", llm_setup_hint()), "project_id": body.project_id}
    except LLMTransportError as e:
        return {**_json_error("llm_unreachable", str(e)), "project_id": body.project_id}
    except RuntimeError as e:
        return {**_json_error("llm_bad_response", str(e)), "project_id": body.project_id}

    reqs = data.get("requirements")
    if reqs is None:
        return {
            **_json_error("llm_bad_response", "Missing requirements array"),
            "project_id": body.project_id,
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_REQ),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "requirements": reqs if isinstance(reqs, list) else [],
    }


async def regenerate_requirements_from_documents(
    body: RegenerateFromDocumentsBody,
) -> dict[str, Any]:
    import json

    system_prompt = load_prompt("system/requirement_regeneration.txt")
    user_template = load_prompt("user/requirement_regeneration.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    prior_blob = json.dumps(body.prior_requirements, ensure_ascii=False, indent=2)[:12000]
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        categories_label=_cats_label(body.requirement_categories),
        document_context=_ctx(body),
        additional_block=_extras_block(body),
        prior_requirements_blob=prior_blob,
        user_feedback=body.user_feedback.strip(),
    )
    user_payload = _append_examples_block(user_payload, body)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(
            messages=messages, temperature=0.25, profile=_REQ
        )
    except LLMConfigurationError:
        return {**_json_error("llm_unavailable", llm_setup_hint()), "project_id": body.project_id}
    except LLMTransportError as e:
        return {**_json_error("llm_unreachable", str(e)), "project_id": body.project_id}
    except RuntimeError as e:
        return {**_json_error("llm_bad_response", str(e)), "project_id": body.project_id}

    reqs = data.get("requirements")
    if reqs is None:
        return {
            **_json_error("llm_bad_response", "Missing requirements array"),
            "project_id": body.project_id,
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_REQ),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "requirements": reqs if isinstance(reqs, list) else [],
    }
