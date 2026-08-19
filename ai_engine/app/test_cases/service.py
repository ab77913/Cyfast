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
from app.shared.example_prompt_builder import (
    build_test_case_examples_block,
    context_suggests_api,
)
from app.shared.prompt_loader import load_prompt

_TC = LLMProfile.TEST_CASES
MAX_AI_COVERAGE_RETRIES = 3

_ALLOWED_TEST_TYPES = frozenset({
    "POSITIVE",
    "NEGATIVE",
    "VALIDATION",
    "BOUNDARY",
    "WORKFLOW",
    "ERROR_HANDLING",
    "DATA_VALIDATION",
    "REGRESSION",
})

_ALLOWED_PRIORITIES = frozenset({"critical", "high", "medium", "low"})


class GenerateTestCasesBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    requirement_refs: str | None = Field(
        default=None,
        description="Optional requirement ids or text the tests must cover.",
    )
    context: str = Field(
        ...,
        min_length=1,
        description="Design notes, user story, or environment constraints.",
    )


class RequirementContextItem(BaseModel):
    requirement_id: int = Field(..., ge=1)
    requirement_no: str | None = None
    title: str | None = None
    description: str = Field(default="")
    version: str | None = None


class ScenarioContextItem(BaseModel):
    test_scenario_id: int = Field(..., ge=1)
    scenario_no: str | None = None
    scenario_type: str | None = None
    scenario_title: str | None = None
    objective: str | None = None
    priority: str | None = None
    preconditions: str | None = None
    test_steps: list[Any] | dict[str, Any] | str | None = None
    test_data: str | None = None
    expected_results: str | None = None
    requirement_id: int | None = None
    requirement_no: str | None = None
    requirement_version: str | None = None


class GenerateTestCasesFromScenariosBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    scenarios: list[ScenarioContextItem] = Field(..., min_length=1, max_length=50)
    requirements: list[RequirementContextItem] = Field(default_factory=list)
    additional_instructions: str | None = Field(
        default=None,
        description="Optional user hints for test case focus.",
    )


class RegenerateTestCasesFromScenariosBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    scenarios: list[ScenarioContextItem] = Field(..., min_length=1, max_length=50)
    requirements: list[RequirementContextItem] = Field(default_factory=list)
    prior_test_cases: list[dict[str, Any]] = Field(default_factory=list)
    user_feedback: str = Field(..., min_length=1)
    additional_instructions: str | None = Field(
        default=None,
        description="Optional user hints for test case focus.",
    )


def _json_error(status: str, message: str) -> dict[str, Any]:
    return {
        "status": status,
        "model": resolved_chat_model(_TC),
        "test_cases": [],
        "message": message,
    }


def _extras_block(extras: str | None) -> str:
    if extras is None or not str(extras).strip():
        return ""
    t = str(extras).strip()
    max_extra = 4000
    if len(t) > max_extra:
        t = t[: max_extra - 40] + "\n...[truncated]..."
    return f"\n\nADDITIONAL INSTRUCTIONS:\n{t}"


def _blob(payload: Any, max_chars: int) -> str:
    raw = json.dumps(payload, ensure_ascii=False, indent=2)
    if len(raw) > max_chars:
        return raw[: max_chars - 40] + "\n...[truncated]..."
    return raw


def _natural_sort_key(text: str) -> tuple[Any, ...]:
    s = str(text or "").strip().upper()
    if not s:
        return (1, 0)
    parts = re.split(r"(\d+)", s)
    key: list[Any] = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            key.append(int(part))
        else:
            key.append(part.lower())
    return (0, *key)


def _sort_scenarios_for_prompt(
    scenarios: list[ScenarioContextItem],
) -> list[ScenarioContextItem]:
    indexed = list(enumerate(scenarios))

    def sort_key(item: tuple[int, ScenarioContextItem]) -> tuple[Any, ...]:
        idx, scenario = item
        req_no = str(scenario.requirement_no or "").strip()
        if req_no:
            return (0, _natural_sort_key(req_no), idx)
        return (1, idx)

    indexed.sort(key=sort_key)
    return [scenario for _, scenario in indexed]


def _normalize_compare_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _expected_result_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and isinstance(value.get("expected"), str):
        return value["expected"]
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    except TypeError:
        return str(value)


def _duplicate_key(tc: dict[str, Any]) -> str:
    return (
        f"{_normalize_compare_text(tc.get('test_case_name'))}|"
        f"{_normalize_compare_text(_expected_result_text(tc.get('expected_result')))}"
    )


def _scenario_id_from_item(item: dict[str, Any]) -> int | None:
    raw = item.get("test_scenario_id", item.get("scenario_id"))
    if raw is None:
        return None
    try:
        sid = int(raw)
    except (TypeError, ValueError):
        return None
    return sid if sid > 0 else None


def _scenario_title_key(item: dict[str, Any]) -> str:
    return _normalize_compare_text(item.get("scenario_title") or item.get("title"))


def _assign_test_case_to_scenario(
    tc: dict[str, Any],
    scenario_index_by_id: dict[int, int],
    scenario_index_by_title: dict[str, int],
) -> int | None:
    sid = _scenario_id_from_item(tc)
    if sid is not None and sid in scenario_index_by_id:
        return scenario_index_by_id[sid]
    title_key = _scenario_title_key(tc)
    if title_key and title_key in scenario_index_by_title:
        return scenario_index_by_title[title_key]
    return None


def _copy_traceability_from_scenario(
    tc: dict[str, Any],
    scenario: dict[str, Any],
) -> dict[str, Any]:
    out = dict(tc)
    sid = _scenario_id_from_item(scenario)
    if sid is not None:
        out["scenario_id"] = sid
    title = scenario.get("scenario_title") or scenario.get("title")
    if title:
        out["scenario_title"] = str(title)
    req_id = scenario.get("requirement_id")
    if req_id is not None:
        out["requirement_id"] = req_id
    req_no = scenario.get("requirement_no")
    if req_no:
        out["requirement_no"] = req_no
    return out


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


def _normalize_expected_result(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
            elif item is not None:
                try:
                    parts.append(json.dumps(item, ensure_ascii=False))
                except TypeError:
                    parts.append(str(item))
        return "\n".join(parts) if parts else None
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, indent=2)
    text = str(value).strip()
    return text or None


def _step_action_text(step: Any) -> str:
    if step is None:
        return ""
    if isinstance(step, str):
        return step.strip()
    if isinstance(step, dict):
        for key in ("action", "step", "detail"):
            raw = step.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
    return ""


def _step_expected_text(step: Any) -> str:
    if isinstance(step, dict):
        for key in ("expected", "result"):
            raw = step.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
    return ""


def _normalize_test_steps(raw: Any) -> tuple[list[dict[str, Any]] | None, str | None]:
    if raw is None:
        return None, "missing test_steps"
    steps_raw: list[Any]
    if isinstance(raw, list):
        steps_raw = raw
    elif isinstance(raw, dict):
        steps_raw = [raw]
    elif isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None, "missing test_steps"
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return None, "invalid test_steps"
        if isinstance(parsed, list):
            steps_raw = parsed
        elif isinstance(parsed, dict):
            steps_raw = [parsed]
        else:
            return None, "invalid test_steps"
    else:
        return None, "invalid test_steps"

    if not steps_raw:
        return None, "missing test_steps"

    normalized: list[dict[str, Any]] = []
    for idx, step in enumerate(steps_raw, start=1):
        action = _step_action_text(step)
        if not action:
            return None, "test_steps missing action text"
        expected = _step_expected_text(step)
        if not expected:
            return None, "test_steps missing expected text"
        if isinstance(step, dict):
            out_step = dict(step)
            out_step["action"] = action
            out_step["expected"] = expected
            if out_step.get("step_no") is None:
                out_step["step_no"] = idx
            normalized.append(out_step)
        else:
            normalized.append(
                {"step_no": idx, "action": action, "expected": expected}
            )
    return normalized, None


def _normalize_tags(raw: Any) -> list[str] | None:
    if not isinstance(raw, list) or not raw:
        return None
    tags = [str(tag).strip() for tag in raw if str(tag).strip()]
    return tags or None


def _normalize_automation_percentage(raw: Any) -> int | None:
    if raw is None:
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    if 0 <= value <= 100:
        return value
    return None


def _normalize_test_type(raw: Any) -> str | None:
    token = str(raw or "").strip().upper().replace(" ", "_").replace("-", "_")
    if token in _ALLOWED_TEST_TYPES:
        return token
    return None


def _normalize_priority(raw: Any) -> str | None:
    token = str(raw or "").strip().lower()
    if token in _ALLOWED_PRIORITIES:
        return token
    return None


def _validate_ai_test_case_row(tc: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not str(tc.get("test_case_name") or tc.get("title") or "").strip():
        errors.append("missing test_case_name")
    if not str(
        tc.get("test_case_description") or tc.get("description") or ""
    ).strip():
        errors.append("missing test_case_description")
    if _normalize_test_type(tc.get("test_type") or tc.get("type")) is None:
        errors.append("missing or unsupported test_type")
    if _normalize_priority(tc.get("priority")) is None:
        errors.append("missing or unsupported priority")
    if not str(tc.get("preconditions") or "").strip():
        errors.append("missing preconditions")
    _, step_error = _normalize_test_steps(
        tc.get("test_steps") if tc.get("test_steps") is not None else tc.get("steps")
    )
    if step_error:
        errors.append(step_error)
    if _normalize_expected_result(
        tc.get("expected_result")
        if tc.get("expected_result") is not None
        else tc.get("expected_results")
    ) is None:
        errors.append("missing expected_result")
    if _normalize_tags(tc.get("tags")) is None:
        errors.append("missing tags")
    if _normalize_automation_percentage(tc.get("automation_percentage")) is None:
        errors.append("missing or invalid automation_percentage")
    return errors


def _dedupe_within_scenario(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for tc in cases:
        key = _duplicate_key(tc)
        if key in seen:
            continue
        seen.add(key)
        out.append(tc)
    return out


def _empty_scenario_buckets(scenario_count: int) -> dict[int, list[dict[str, Any]]]:
    return {i: [] for i in range(1, scenario_count + 1)}


def _missing_scenario_ids_from_buckets(
    sorted_scenarios: list[dict[str, Any]],
    buckets: dict[int, list[dict[str, Any]]],
) -> list[int]:
    missing: list[int] = []
    for group_idx, scenario in enumerate(sorted_scenarios, start=1):
        sid = _scenario_id_from_item(scenario)
        if sid is None:
            continue
        if not buckets.get(group_idx):
            missing.append(sid)
    return missing


def _merge_scenario_buckets(
    target: dict[int, list[dict[str, Any]]],
    source: dict[int, list[dict[str, Any]]],
) -> None:
    for group_idx, cases in source.items():
        if not cases:
            continue
        combined = _dedupe_within_scenario(target.get(group_idx, []) + cases)
        target[group_idx] = combined


def _ingest_raw_test_cases(
    sorted_scenarios: list[dict[str, Any]],
    raw_test_cases: list[Any],
) -> tuple[dict[int, list[dict[str, Any]]], list[dict[str, Any]]]:
    scenario_index_by_id: dict[int, int] = {}
    scenario_index_by_title: dict[str, int] = {}
    for idx, scenario in enumerate(sorted_scenarios, start=1):
        sid = _scenario_id_from_item(scenario)
        if sid is not None:
            scenario_index_by_id[sid] = idx
        title_key = _scenario_title_key(scenario)
        if title_key:
            scenario_index_by_title[title_key] = idx

    buckets = _empty_scenario_buckets(len(sorted_scenarios))
    rejected_rows: list[dict[str, Any]] = []

    for row_idx, raw in enumerate(raw_test_cases):
        if not isinstance(raw, dict):
            rejected_rows.append(
                {
                    "row_index": row_idx,
                    "reasons": ["test case row is not an object"],
                }
            )
            continue

        errors = _validate_ai_test_case_row(raw)
        group_idx = _assign_test_case_to_scenario(
            raw,
            scenario_index_by_id,
            scenario_index_by_title,
        )
        if group_idx is None:
            errors.append("missing or unknown scenario_id/test_scenario_id")
        if errors:
            rejected_rows.append(
                {
                    "row_index": row_idx,
                    "scenario_id": _scenario_id_from_item(raw),
                    "test_case_name": raw.get("test_case_name") or raw.get("title"),
                    "reasons": errors,
                }
            )
            continue

        scenario = sorted_scenarios[group_idx - 1]
        tc = _copy_traceability_from_scenario(raw, scenario)
        steps, step_error = _normalize_test_steps(
            raw.get("test_steps")
            if raw.get("test_steps") is not None
            else raw.get("steps")
        )
        if step_error or not steps:
            rejected_rows.append(
                {
                    "row_index": row_idx,
                    "scenario_id": _scenario_id_from_item(scenario),
                    "reasons": [step_error or "invalid test_steps"],
                }
            )
            continue

        tc["test_case_name"] = str(
            raw.get("test_case_name") or raw.get("title") or ""
        ).strip()
        tc["test_case_description"] = str(
            raw.get("test_case_description") or raw.get("description") or ""
        ).strip()
        tc["test_type"] = _normalize_test_type(
            raw.get("test_type") or raw.get("type")
        )
        tc["priority"] = _normalize_priority(raw.get("priority"))
        tc["preconditions"] = str(raw.get("preconditions") or "").strip()
        tc["test_steps"] = steps
        tc["test_data"] = _normalize_test_data(raw.get("test_data"))
        tc["expected_result"] = _normalize_expected_result(
            raw.get("expected_result")
            if raw.get("expected_result") is not None
            else raw.get("expected_results")
        )
        tc["tags"] = _normalize_tags(raw.get("tags"))
        tc["automation_percentage"] = _normalize_automation_percentage(
            raw.get("automation_percentage")
        )
        buckets[group_idx].append(tc)

    return buckets, rejected_rows


def _finalize_test_cases_from_buckets(
    sorted_scenarios: list[dict[str, Any]],
    buckets: dict[int, list[dict[str, Any]]],
    rejected_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    result: list[dict[str, Any]] = []
    covered_scenario_ids: list[int] = []
    for group_idx, scenario in enumerate(sorted_scenarios, start=1):
        cases = _dedupe_within_scenario(buckets.get(group_idx, []))
        if not cases:
            continue
        sid = _scenario_id_from_item(scenario)
        if sid is not None:
            covered_scenario_ids.append(sid)
        for case_idx, tc in enumerate(cases, start=1):
            numbered = dict(tc)
            numbered["test_case_no"] = f"TC-{group_idx}.{case_idx}"
            result.append(numbered)

    scenario_ids_in_order = [
        _scenario_id_from_item(scenario) for scenario in sorted_scenarios
    ]
    missing_scenario_ids = [
        sid
        for sid in scenario_ids_in_order
        if sid is not None and sid not in covered_scenario_ids
    ]
    validation = {
        "rejected_rows": rejected_rows,
        "missing_test_scenario_ids": missing_scenario_ids,
    }
    return result, validation


def _process_test_cases(
    sorted_scenarios: list[dict[str, Any]],
    raw_test_cases: list[Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    buckets, rejected_rows = _ingest_raw_test_cases(sorted_scenarios, raw_test_cases)
    return _finalize_test_cases_from_buckets(sorted_scenarios, buckets, rejected_rows)


def _validation_failure_message(validation: dict[str, Any]) -> str:
    parts: list[str] = []
    missing = validation.get("missing_test_scenario_ids") or []
    if missing:
        parts.append(
            "Missing test cases for test_scenario_id(s): "
            + ", ".join(str(sid) for sid in missing)
        )
    rejected = validation.get("rejected_rows") or []
    if rejected:
        parts.append(f"Rejected {len(rejected)} incomplete AI test case row(s).")
        sample = rejected[:5]
        for item in sample:
            sid = item.get("scenario_id")
            reasons = ", ".join(item.get("reasons") or [])
            label = f"scenario_id={sid}" if sid is not None else f"row {item.get('row_index')}"
            parts.append(f"{label}: {reasons}")
        if len(rejected) > len(sample):
            parts.append(f"...and {len(rejected) - len(sample)} more rejected row(s).")
    return "; ".join(parts) if parts else "AI test case validation failed."


def _renumber_and_validate_test_cases(
    sorted_scenarios: list[dict[str, Any]],
    raw_test_cases: list[Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    return _process_test_cases(sorted_scenarios, raw_test_cases)


def _scenario_context_text(scenarios: list[ScenarioContextItem]) -> list[str]:
    parts: list[str] = []
    for scenario in scenarios:
        parts.extend(
            [
                scenario.scenario_title,
                scenario.objective,
                scenario.preconditions,
                scenario.test_data,
                scenario.expected_results,
            ]
        )
        if scenario.test_steps is not None:
            if isinstance(scenario.test_steps, str):
                parts.append(scenario.test_steps)
            else:
                parts.append(json.dumps(scenario.test_steps, ensure_ascii=False))
    return parts


def _include_api_test_case_examples(body: GenerateTestCasesFromScenariosBody) -> bool:
    parts: list[str | None] = [body.additional_instructions]
    parts.extend(_scenario_context_text(body.scenarios))
    for requirement in body.requirements:
        parts.extend([requirement.title, requirement.description])
    return context_suggests_api(*parts)


def _append_examples_block(
    user_payload: str,
    body: GenerateTestCasesFromScenariosBody,
) -> str:
    examples_block = build_test_case_examples_block(
        include_api_examples=_include_api_test_case_examples(body)
    )
    if not examples_block:
        return user_payload
    return f"{user_payload}\n\n{examples_block}"


def _build_initial_user_payload(
    user_template: str,
    *,
    project_id: int,
    org_line: str,
    scenarios_blob: str,
    requirements_blob: str,
    additional_block: str,
    body: GenerateTestCasesFromScenariosBody,
) -> str:
    user_payload = user_template.format(
        project_id=project_id,
        org_line=org_line,
        coverage_block="",
        scenarios_blob=scenarios_blob,
        requirements_blob=requirements_blob,
        additional_block=additional_block,
    )
    return _append_examples_block(user_payload, body)


def _build_retry_user_payload(
    retry_template: str,
    *,
    project_id: int,
    org_line: str,
    missing_scenario_ids: list[int],
    scenarios_blob: str,
    requirements_blob: str,
    additional_block: str,
) -> str:
    return retry_template.format(
        project_id=project_id,
        org_line=org_line,
        missing_scenario_ids=", ".join(str(sid) for sid in missing_scenario_ids),
        scenarios_blob=scenarios_blob,
        requirements_blob=requirements_blob,
        additional_block=additional_block,
    )


async def generate_test_cases(body: GenerateTestCasesBody) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_case_topic.txt")
    user_template = load_prompt("user/test_case_topic.txt")
    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    requirement_refs_block = ""
    if body.requirement_refs:
        requirement_refs_block = f"REQUIREMENT_REFS:\n{body.requirement_refs}\n\n"
    user_payload = user_template.format(
        project_id=body.project_id,
        org_line=org_line,
        requirement_refs_block=requirement_refs_block,
        context=body.context,
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]
    try:
        data = await chat_completion_json(messages=messages, temperature=0.25, profile=_TC)
    except LLMConfigurationError:
        return {
            "status": "llm_unavailable",
            "model": resolved_chat_model(_TC),
            "test_cases": [],
            "message": llm_setup_hint(),
        }
    except LLMTransportError as e:
        return {
            "status": "llm_unreachable",
            "model": resolved_chat_model(_TC),
            "test_cases": [],
            "message": str(e),
        }
    except RuntimeError as e:
        return {
            "status": "llm_bad_response",
            "model": resolved_chat_model(_TC),
            "test_cases": [],
            "message": str(e),
        }
    return {
        "status": "ok",
        "model": resolved_chat_model(_TC),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        **data,
    }


async def generate_test_cases_from_scenarios(
    body: GenerateTestCasesFromScenariosBody,
) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_case_generation.txt")
    user_template = load_prompt("user/test_case_generation.txt")
    retry_template = load_prompt("user/test_case_generation_retry.txt")

    sorted_scenarios = _sort_scenarios_for_prompt(body.scenarios)
    scenarios_payload = [s.model_dump() for s in sorted_scenarios]
    requirements_payload = [r.model_dump() for r in body.requirements]

    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    additional_block = _extras_block(body.additional_instructions)
    requirements_blob = _blob(requirements_payload, 12000)

    merged_buckets = _empty_scenario_buckets(len(scenarios_payload))
    all_rejected_rows: list[dict[str, Any]] = []
    llm_errors: list[str] = []

    for attempt in range(MAX_AI_COVERAGE_RETRIES):
        missing_ids = _missing_scenario_ids_from_buckets(
            scenarios_payload, merged_buckets
        )
        if attempt > 0 and not missing_ids:
            break

        if attempt == 0:
            call_scenarios = scenarios_payload
            user_payload = _build_initial_user_payload(
                user_template,
                project_id=body.project_id,
                org_line=org_line,
                scenarios_blob=_blob(call_scenarios, 26000),
                requirements_blob=requirements_blob,
                additional_block=additional_block,
                body=body,
            )
        else:
            call_scenarios = [
                scenario
                for scenario in scenarios_payload
                if _scenario_id_from_item(scenario) in missing_ids
            ]
            user_payload = _build_retry_user_payload(
                retry_template,
                project_id=body.project_id,
                org_line=org_line,
                missing_scenario_ids=missing_ids,
                scenarios_blob=_blob(call_scenarios, 26000),
                requirements_blob=requirements_blob,
                additional_block=additional_block,
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ]

        try:
            data = await chat_completion_json(
                messages=messages, temperature=0.25, profile=_TC
            )
        except LLMConfigurationError:
            return {
                **_json_error("llm_unavailable", llm_setup_hint()),
                "project_id": body.project_id,
            }
        except LLMTransportError as e:
            return {
                **_json_error("llm_unreachable", str(e)),
                "project_id": body.project_id,
            }
        except RuntimeError as e:
            return {
                **_json_error("llm_bad_response", str(e)),
                "project_id": body.project_id,
            }

        test_cases = data.get("test_cases")
        if not isinstance(test_cases, list):
            llm_errors.append(
                f"attempt {attempt + 1}: test_cases must be an array"
            )
            continue

        buckets, rejected_rows = _ingest_raw_test_cases(
            scenarios_payload, test_cases
        )
        _merge_scenario_buckets(merged_buckets, buckets)
        all_rejected_rows.extend(rejected_rows)

    processed, validation = _finalize_test_cases_from_buckets(
        scenarios_payload,
        merged_buckets,
        all_rejected_rows,
    )
    if validation.get("missing_test_scenario_ids"):
        validation["retry_attempts"] = MAX_AI_COVERAGE_RETRIES
        if llm_errors:
            validation["llm_errors"] = llm_errors
        return {
            **_json_error(
                "validation_failed",
                _validation_failure_message(validation),
            ),
            "project_id": body.project_id,
            "validation": validation,
        }
    if not processed:
        return {
            **_json_error(
                "validation_failed",
                "No valid AI test cases after validation and retries.",
            ),
            "project_id": body.project_id,
            "validation": validation,
        }

    return {
        "status": "ok",
        "model": resolved_chat_model(_TC),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "test_cases": processed,
    }


def _build_regenerate_user_payload(
    user_template: str,
    *,
    project_id: int,
    org_line: str,
    scenarios_blob: str,
    requirements_blob: str,
    additional_block: str,
    body: RegenerateTestCasesFromScenariosBody,
) -> str:
    user_payload = _build_initial_user_payload(
        user_template,
        project_id=project_id,
        org_line=org_line,
        scenarios_blob=scenarios_blob,
        requirements_blob=requirements_blob,
        additional_block=additional_block,
        body=body,
    )
    prior_blob = json.dumps(body.prior_test_cases, ensure_ascii=False, indent=2)[:12000]
    feedback = body.user_feedback.strip()
    return (
        f"{user_payload}\n\n"
        "PRIOR TEST CASES TO REVISE (JSON):\n"
        f"{prior_blob}\n\n"
        "USER FEEDBACK:\n"
        f"{feedback}\n"
    )


async def regenerate_test_cases_from_scenarios(
    body: RegenerateTestCasesFromScenariosBody,
) -> dict[str, Any]:
    system_prompt = load_prompt("system/test_case_generation.txt")
    user_template = load_prompt("user/test_case_generation.txt")
    retry_template = load_prompt("user/test_case_generation_retry.txt")

    sorted_scenarios = _sort_scenarios_for_prompt(body.scenarios)
    scenarios_payload = [s.model_dump() for s in sorted_scenarios]
    requirements_payload = [r.model_dump() for r in body.requirements]

    org_line = (
        f", organization_id={body.organization_id}"
        if body.organization_id is not None
        else ""
    )
    additional_block = _extras_block(body.additional_instructions)
    requirements_blob = _blob(requirements_payload, 12000)

    merged_buckets = _empty_scenario_buckets(len(scenarios_payload))
    all_rejected_rows: list[dict[str, Any]] = []
    llm_errors: list[str] = []

    for attempt in range(MAX_AI_COVERAGE_RETRIES):
        missing_ids = _missing_scenario_ids_from_buckets(
            scenarios_payload, merged_buckets
        )
        if attempt > 0 and not missing_ids:
            break

        if attempt == 0:
            call_scenarios = scenarios_payload
            user_payload = _build_regenerate_user_payload(
                user_template,
                project_id=body.project_id,
                org_line=org_line,
                scenarios_blob=_blob(call_scenarios, 26000),
                requirements_blob=requirements_blob,
                additional_block=additional_block,
                body=body,
            )
        else:
            call_scenarios = [
                scenario
                for scenario in scenarios_payload
                if _scenario_id_from_item(scenario) in missing_ids
            ]
            user_payload = _build_retry_user_payload(
                retry_template,
                project_id=body.project_id,
                org_line=org_line,
                missing_scenario_ids=missing_ids,
                scenarios_blob=_blob(call_scenarios, 26000),
                requirements_blob=requirements_blob,
                additional_block=additional_block,
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_payload},
        ]

        try:
            data = await chat_completion_json(
                messages=messages, temperature=0.28, profile=_TC
            )
        except LLMConfigurationError:
            return {
                **_json_error("llm_unavailable", llm_setup_hint()),
                "project_id": body.project_id,
            }
        except LLMTransportError as e:
            return {
                **_json_error("llm_unreachable", str(e)),
                "project_id": body.project_id,
            }
        except RuntimeError as e:
            return {
                **_json_error("llm_bad_response", str(e)),
                "project_id": body.project_id,
            }

        test_cases = data.get("test_cases")
        if not isinstance(test_cases, list):
            llm_errors.append(
                f"attempt {attempt + 1}: test_cases must be an array"
            )
            continue

        buckets, rejected_rows = _ingest_raw_test_cases(
            scenarios_payload, test_cases
        )
        _merge_scenario_buckets(merged_buckets, buckets)
        all_rejected_rows.extend(rejected_rows)

    processed, validation = _finalize_test_cases_from_buckets(
        scenarios_payload,
        merged_buckets,
        all_rejected_rows,
    )
    if validation.get("missing_test_scenario_ids"):
        validation["retry_attempts"] = MAX_AI_COVERAGE_RETRIES
        if llm_errors:
            validation["llm_errors"] = llm_errors
        return {
            **_json_error(
                "validation_failed",
                _validation_failure_message(validation),
            ),
            "project_id": body.project_id,
            "validation": validation,
        }
    if not processed:
        return {
            **_json_error(
                "validation_failed",
                "No valid AI test cases after validation and retries.",
            ),
            "project_id": body.project_id,
            "validation": validation,
        }

    return {
        "status": "ok",
        "model": resolved_chat_model(_TC),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "test_cases": processed,
    }
