from typing import Any

import json
import re

from pydantic import BaseModel, Field

from app.shared.llm import (
    LLMConfigurationError,
    LLMTransportError,
    chat_completion_json,
    llm_setup_hint,
    resolved_chat_model,
)
from app.shared.llm_profiles import LLMProfile
from app.shared.example_prompt_builder import build_scenario_examples_block
from app.shared.prompt_loader import load_prompt

# Dedicated stack: TEST_SCENARIOS_LLM_PROVIDER, *_OPENAI_MODEL, *_OLLAMA_MODEL (optional *_OLLAMA_BASE_URL).
_TS = LLMProfile.TEST_SCENARIOS


class RequirementContextItem(BaseModel):
    requirement_id: int = Field(..., ge=1)
    requirement_no: str | None = None
    title: str | None = None
    description: str = Field(default="")
    version: str | None = None


class GenerateScenariosFromRequirementsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirements: list[RequirementContextItem] = Field(..., min_length=1, max_length=50)
    scenario_types: list[str] = Field(..., min_length=1)
    safety_options: dict[str, Any] = Field(default_factory=dict)
    additional_instructions: str | None = Field(
        default=None,
        description="Optional user hints for scenario focus and domain tone.",
    )


class RegenerateScenariosFromRequirementsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirements: list[RequirementContextItem] = Field(..., min_length=1, max_length=50)
    scenario_types: list[str] = Field(..., min_length=1)
    safety_options: dict[str, Any] = Field(default_factory=dict)
    prior_scenarios: list[dict[str, Any]] = Field(default_factory=list)
    user_feedback: str = Field(..., min_length=1)
    additional_instructions: str | None = None


def _extras_block(extras: str | None) -> str:
    if extras is None or not str(extras).strip():
        return ""
    t = str(extras).strip()
    max_extra = 4000
    if len(t) > max_extra:
        t = t[: max_extra - 40] + "\n...[truncated]..."
    return f"\n\nADDITIONAL INSTRUCTIONS:\n{t}"


def _types_label(types: list[str]) -> str:
    return ", ".join(str(x).strip().upper() for x in types if str(x).strip())


def _safety_block(opts: dict[str, Any]) -> str:
    if not opts:
        return ""
    lines = []
    labels = {
        "safety_validation": "Include explicit safety validation scenarios where applicable.",
        "fault_handling": "Include fault handling / failure mode scenarios.",
        "data_integrity": "Include data integrity / consistency checks.",
        "audit_logging": "Include audit trail and logging validation.",
        "regulatory": "Call out regulatory / compliance validation considerations in narratives.",
    }
    for k, text in labels.items():
        if opts.get(k) is True:
            lines.append(text)
    if not lines:
        return ""
    return "\nREGULATED / SAFETY-CRITICAL ADD-ONS (apply when consistent with requirements):\n" + "\n".join(
        f"- {ln}" for ln in lines
    )


def _append_examples_block(user_payload: str) -> str:
    examples_block = build_scenario_examples_block()
    if not examples_block:
        return user_payload
    return f"{user_payload}\n\n{examples_block}"


def _json_error(status: str, message: str) -> dict[str, Any]:
    return {
        "status": status,
        "model": resolved_chat_model(_TS),
        "scenarios": [],
        "message": message,
    }


def _requirements_blob(items: list[RequirementContextItem]) -> str:
    payload = [m.model_dump() for m in items]
    raw = json.dumps(payload, ensure_ascii=False, indent=2)
    max_r = 24000
    if len(raw) > max_r:
        return raw[: max_r - 40] + "\n...[truncated]..."
    return raw


_SCENARIO_TYPE_TOKEN_RE = re.compile(r"[\s\-]+")

_SCENARIO_TYPE_FALLBACKS: dict[str, list[str]] = {
    "USABILITY": ["FUNCTIONAL", "WORKFLOW"],
    "PERFORMANCE": ["BOUNDARY", "FUNCTIONAL"],
    "DATA_INTEGRITY": ["VALIDATION", "FUNCTIONAL"],
    "SECURITY": ["NEGATIVE", "VALIDATION", "FUNCTIONAL"],
    "INTEGRATION": ["WORKFLOW", "FUNCTIONAL"],
    "REGRESSION": ["FUNCTIONAL"],
    "POSITIVE": ["FUNCTIONAL"],
}


def _normalize_scenario_type_token(raw: Any) -> str:
    token = _SCENARIO_TYPE_TOKEN_RE.sub("_", str(raw or "").strip().upper())
    return token.strip("_")


def _selected_scenario_types(scenario_types: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in scenario_types:
        token = _normalize_scenario_type_token(raw)
        if not token or token in seen:
            continue
        seen.add(token)
        out.append(token)
    return out or ["FUNCTIONAL"]


def _default_scenario_type(selected_types: list[str]) -> str:
    if "FUNCTIONAL" in selected_types:
        return "FUNCTIONAL"
    return selected_types[0]


def _normalize_scenario_type(
    raw: Any,
    selected_types: list[str],
    safety_options: dict[str, Any] | None = None,
) -> str:
    selected = set(selected_types)
    token = _normalize_scenario_type_token(raw) or "FUNCTIONAL"
    if token in selected:
        return token
    opts = safety_options or {}
    if token == "DATA_INTEGRITY" and opts.get("data_integrity") and "VALIDATION" in selected:
        return "VALIDATION"
    for candidate in _SCENARIO_TYPE_FALLBACKS.get(token, ["FUNCTIONAL"]):
        if candidate in selected:
            return candidate
    return _default_scenario_type(selected_types)


def _normalize_test_data(value: Any) -> str:
    if value is None or value == "":
        return "{}"
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped or stripped == "[object Object]":
            return "{}"
        return value
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value)


def _requirement_id_from_scenario(item: dict[str, Any]) -> int | None:
    raw = item.get("requirement_id")
    if raw is None:
        return None
    try:
        rid = int(raw)
    except (TypeError, ValueError):
        return None
    return rid if rid > 0 else None


def _process_scenarios(
    raw_scenarios: list[Any],
    requirements: list[RequirementContextItem],
    scenario_types: list[str],
    safety_options: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    selected_types = _selected_scenario_types(scenario_types)
    req_by_id = {req.requirement_id: req.model_dump() for req in requirements}
    processed: list[dict[str, Any]] = []
    covered_ids: set[int] = set()

    for raw in raw_scenarios:
        if not isinstance(raw, dict):
            continue
        rid = _requirement_id_from_scenario(raw)
        if rid is None or rid not in req_by_id:
            continue
        requirement = req_by_id[rid]
        scenario = dict(raw)
        scenario["requirement_id"] = rid
        if not scenario.get("requirement_version") and requirement.get("version"):
            scenario["requirement_version"] = requirement.get("version")
        scenario["scenario_type"] = _normalize_scenario_type(
            scenario.get("scenario_type") or scenario.get("type"),
            selected_types,
            safety_options,
        )
        scenario["test_data"] = _normalize_test_data(scenario.get("test_data"))
        processed.append(scenario)
        covered_ids.add(rid)

    missing_requirement_ids = [
        req.requirement_id
        for req in requirements
        if req.requirement_id not in covered_ids
    ]
    return processed, {"missing_requirement_ids": missing_requirement_ids}


def _scenario_validation_failure_message(validation: dict[str, Any]) -> str:
    missing = validation.get("missing_requirement_ids") or []
    if not missing:
        return "AI scenario validation failed."
    return (
        "Missing scenarios for requirement_id(s): "
        + ", ".join(str(rid) for rid in missing)
    )


async def generate_test_scenarios_from_requirements(
    body: GenerateScenariosFromRequirementsBody,
) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_scenario_generation.txt")
    user_template = load_prompt("user/test_scenario_generation.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    safety = _safety_block(body.safety_options)
    if safety:
        safety = f"{safety}\n"
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        scenario_types_label=_types_label(body.scenario_types),
        safety_block=safety,
        requirements_blob=_requirements_blob(body.requirements),
        additional_block=_extras_block(body.additional_instructions),
    )
    user_payload = _append_examples_block(user_payload)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(
            messages=messages, temperature=0.25, profile=_TS
        )
    except LLMConfigurationError:
        return {**_json_error("llm_unavailable", llm_setup_hint()), "project_id": body.project_id}
    except LLMTransportError as e:
        return {**_json_error("llm_unreachable", str(e)), "project_id": body.project_id}
    except RuntimeError as e:
        return {**_json_error("llm_bad_response", str(e)), "project_id": body.project_id}

    scenarios = data.get("scenarios")
    if scenarios is None:
        return {
            **_json_error("llm_bad_response", "Missing scenarios array"),
            "project_id": body.project_id,
        }
    if not isinstance(scenarios, list):
        return {
            **_json_error("llm_bad_response", "scenarios must be an array"),
            "project_id": body.project_id,
        }

    processed, validation = _process_scenarios(
        scenarios,
        body.requirements,
        body.scenario_types,
        body.safety_options,
    )
    if validation.get("missing_requirement_ids") or not processed:
        return {
            **_json_error(
                "validation_failed",
                _scenario_validation_failure_message(validation)
                if validation.get("missing_requirement_ids")
                else "Model returned no valid scenarios.",
            ),
            "project_id": body.project_id,
            "validation": validation,
        }

    return {
        "status": "ok",
        "model": resolved_chat_model(_TS),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "scenarios": processed,
    }


async def regenerate_test_scenarios_from_requirements(
    body: RegenerateScenariosFromRequirementsBody,
) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_scenario_regeneration.txt")
    user_template = load_prompt("user/test_scenario_regeneration.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    safety = _safety_block(body.safety_options)
    if safety:
        safety = f"{safety}\n"
    prior_blob = json.dumps(body.prior_scenarios, ensure_ascii=False, indent=2)[:12000]
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        scenario_types_label=_types_label(body.scenario_types),
        safety_block=safety,
        requirements_blob=f"{_requirements_blob(body.requirements)}\n\n",
        additional_block=f"{_extras_block(body.additional_instructions)}\n\n",
        prior_scenarios_blob=prior_blob,
        user_feedback=body.user_feedback.strip(),
    )
    user_payload = _append_examples_block(user_payload)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(
            messages=messages, temperature=0.28, profile=_TS
        )
    except LLMConfigurationError:
        return {**_json_error("llm_unavailable", llm_setup_hint()), "project_id": body.project_id}
    except LLMTransportError as e:
        return {**_json_error("llm_unreachable", str(e)), "project_id": body.project_id}
    except RuntimeError as e:
        return {**_json_error("llm_bad_response", str(e)), "project_id": body.project_id}

    scenarios = data.get("scenarios")
    if scenarios is None:
        return {
            **_json_error("llm_bad_response", "Missing scenarios array"),
            "project_id": body.project_id,
        }
    if not isinstance(scenarios, list):
        return {
            **_json_error("llm_bad_response", "scenarios must be an array"),
            "project_id": body.project_id,
        }

    processed, _validation = _process_scenarios(
        scenarios,
        body.requirements,
        body.scenario_types,
        body.safety_options,
    )

    return {
        "status": "ok",
        "model": resolved_chat_model(_TS),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "scenarios": processed,
    }
