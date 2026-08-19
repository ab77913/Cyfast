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

_TD = LLMProfile.TEST_DATA


class GenerateTestDataBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    schema_or_fields: str | None = Field(
        default=None,
        description="Optional: describe fields/types or paste JSON schema.",
    )
    scenario: str = Field(
        ...,
        min_length=1,
        description="What to generate data for (e.g. API negative paths, boundary values).",
    )


async def generate_test_data(body: GenerateTestDataBody) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_data_generation.txt")
    user_template = load_prompt("user/test_data_generation.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    schema_block = ""
    if body.schema_or_fields:
        schema_block = f"SCHEMA_OR_FIELDS:\n{body.schema_or_fields}\n\n"
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        schema_block=schema_block,
        scenario=body.scenario,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(messages=messages, temperature=0.35, profile=_TD)
    except LLMConfigurationError:
        return {
            "status": "llm_unavailable",
            "model": resolved_chat_model(_TD),
            "test_data": [],
            "message": llm_setup_hint(),
        }
    except LLMTransportError as e:
        return {
            "status": "llm_unreachable",
            "model": resolved_chat_model(_TD),
            "test_data": [],
            "message": str(e),
        }
    except RuntimeError as e:
        return {
            "status": "llm_bad_response",
            "model": resolved_chat_model(_TD),
            "test_data": [],
            "message": str(e),
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_TD),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        **data,
    }
