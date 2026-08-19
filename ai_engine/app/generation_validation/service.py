"""LLM-backed validation rubrics for generated requirements, test cases, and other artifacts."""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.shared.llm import (
    LLMConfigurationError,
    LLMTransportError,
    chat_completion_json,
    llm_setup_hint,
    resolved_chat_model,
)
from app.shared.llm_profiles import LLMProfile
from app.shared.prompt_loader import load_prompt

_VAL = LLMProfile.VALIDATION

REQUIREMENT_DIMENSION_IDS = [
    "correct",
    "complete",
    "consistent",
    "testable",
    "traceable",
    "compliant",
    "non_ambiguous",
    "domain_aligned",
]

TEST_CASE_DIMENSION_IDS = [
    "quality_overall",
    "requirement_coverage",
    "expected_behavior_correctness",
    "missing_negative",
    "risk_coverage",
    "boundary_coverage",
    "compliance_alignment",
    "redundancy",
    "automation_readiness",
]

TEST_SCENARIO_DIMENSION_IDS = [
    "correctness",
    "requirement_coverage",
    "atomicity",
    "non_duplication",
    "scenario_type_alignment",
    "precondition_quality",
    "test_steps_quality",
    "test_data_quality",
    "expected_result_quality",
    "automation_readiness",
    "traceability",
]


def _slug(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_")[:64] or "dimension"


class RequirementDraft(BaseModel):
    requirement_no: str | None = None
    requirement_category: str | None = None
    title: str | None = None
    description: str | None = None
    rationale: str | None = None


class RelatedDraftSummary(BaseModel):
    requirement_no: str | None = None
    title: str | None = None
    requirement_category: str | None = None


class ValidateGeneratedRequirementsBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    drafts: list[RequirementDraft] = Field(..., min_length=1, max_length=50)
    document_context_snippet: str | None = Field(
        default=None,
        description="Optional source excerpt or job context snippet for grounding.",
    )
    related_drafts: list[RelatedDraftSummary] = Field(
        default_factory=list,
        description="Brief peer rows for consistency checks.",
        max_length=100,
    )


class TestCaseDraft(BaseModel):
    model_config = ConfigDict(extra="allow")
    requirement_id: int | None = None
    title: str | None = None
    description: str | None = None
    pre_condition: str | None = None
    steps_json: str | dict[str, Any] | list[Any] | None = None


class SourceRequirementRef(BaseModel):
    model_config = ConfigDict(extra="allow")
    requirement_id: int | None = None
    requirement_no: str | None = None
    title: str | None = None
    description: str | None = None


class ValidateGeneratedTestCasesBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    test_case_drafts: list[TestCaseDraft] = Field(..., min_length=1, max_length=80)
    source_requirements: list[SourceRequirementRef] = Field(
        default_factory=list,
        max_length=200,
    )
    document_context_snippet: str | None = None


class TestScenarioDraft(BaseModel):
    model_config = ConfigDict(extra="allow")
    scenario_type: str | None = None
    scenario_no: str | None = None
    title: str | None = None
    objective: str | None = None
    priority: str | None = None
    preconditions: str | None = None
    test_steps: str | dict[str, Any] | list[Any] | None = None
    test_data: str | None = None
    expected_results: str | None = None
    automation_possibility_score: int | None = None


class RelatedScenarioDraftSummary(BaseModel):
    scenario_type: str | None = None
    title: str | None = None
    requirement_no: str | None = None


class ValidateGeneratedTestScenariosBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    scenario_drafts: list[TestScenarioDraft] = Field(..., min_length=1, max_length=50)
    source_requirement: SourceRequirementRef | None = None
    related_scenario_drafts: list[RelatedScenarioDraftSummary] = Field(
        default_factory=list,
        max_length=100,
    )
    document_context_snippet: str | None = None


class ValidateGenericArtifactBody(BaseModel):
    project_id: int = Field(..., ge=1)
    organization_id: int | None = None
    artifact_type: str = Field(..., min_length=2, max_length=80)
    artifact_summary: str = Field(..., min_length=4, description="Structured description / JSON-ish blob.")
    checklist: list[str] = Field(
        ...,
        min_length=3,
        max_length=40,
        description='e.g. ["Clarity", "Traceability"]',
    )
    context_snippet: str | None = None


def _truncate(s: str | None, max_chars: int) -> str | None:
    if s is None:
        return None
    t = str(s).strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 20] + "\n...[truncated]..."


def _coerce_dimension_score(score: Any) -> int | None:
    if isinstance(score, (int, float)):
        return max(1, min(5, int(round(float(score)))))
    if isinstance(score, str):
        text = score.strip()
        if not text:
            return None
        try:
            return max(1, min(5, int(round(float(text)))))
        except ValueError:
            return None
    return None


def _severity_from_score(score: int | None) -> str | None:
    if score is None:
        return None
    if score <= 2:
        return "fail"
    if score == 3:
        return "warn"
    return "pass"


def _normalize_severity(severity: Any, score: int | None) -> str:
    sev = ""
    if isinstance(severity, str):
        sev = severity.strip().lower()

    aliases = {
        "pass": "pass",
        "passed": "pass",
        "ok": "pass",
        "warn": "warn",
        "warning": "warn",
        "fail": "fail",
        "failed": "fail",
    }

    normalized = aliases.get(sev)
    if normalized in ("pass", "warn", "fail"):
        return normalized

    derived = _severity_from_score(score)
    return derived if derived is not None else "unknown"


def _eligible_for_perfect_validation_score(
    dimensions: list[dict[str, Any]],
    recommendations: list[str],
) -> bool:
    """Perfect score (100) requires every dimension fully satisfied with a clean report."""
    if any(str(rec).strip() for rec in recommendations):
        return False

    for dim in dimensions:
        score = dim.get("score")
        if not isinstance(score, int) or score < 5:
            return False
        if dim.get("severity") != "pass":
            return False
        finding = dim.get("finding")
        if isinstance(finding, str) and finding.strip():
            return False

    return bool(dimensions)


def _normalize_overall_score(
    overall: Any,
    dimension_scores: list[int | float],
    *,
    dimensions: list[dict[str, Any]] | None = None,
    recommendations: list[str] | None = None,
    strict_perfect_score: bool = False,
) -> int | None:
    # Authoritative path: when dimensions exist, overall must come from dimensions.
    if dimension_scores:
        avg_score = sum(float(s) for s in dimension_scores) / len(dimension_scores)
        base = max(0, min(100, int(round(avg_score / 5 * 100))))
    else:
        base = None
        # Fallback path: only use model-provided overall when dimensions are missing.
        value: float | None = None
        if isinstance(overall, (int, float)):
            value = float(overall)
        elif isinstance(overall, str):
            text = overall.strip()
            if text:
                try:
                    value = float(text)
                except ValueError:
                    value = None

        if value is not None:
            if 0 <= value <= 5:
                base = max(0, min(100, int(round(value * 20))))
            elif 0 <= value <= 10:
                base = max(0, min(100, int(round(value * 10))))
            elif 0 <= value <= 100:
                base = max(0, min(100, int(round(value))))
            else:
                base = max(0, min(100, int(round(value))))

    if base is None:
        return None

    if strict_perfect_score and base == 100:
        if not _eligible_for_perfect_validation_score(
            dimensions or [],
            recommendations or [],
        ):
            return 99

    return base


def _coerce_dimensions(
    rows: Any,
    required_ids: list[str],
) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    if isinstance(rows, list):
        for item in rows:
            if not isinstance(item, dict):
                continue
            rid = item.get("id") or item.get("dimension") or item.get("key")
            if not isinstance(rid, str):
                continue
            rid_norm = rid.strip().lower().replace("-", "_")
            by_id[rid_norm] = item

    out: list[dict[str, Any]] = []
    for req_id in required_ids:
        row = by_id.get(req_id)
        if row is None:
            out.append(
                {
                    "id": req_id,
                    "score": None,
                    "severity": "unknown",
                    "finding": "Dimension missing from model output.",
                    "hints": [],
                }
            )
            continue
        sci = _coerce_dimension_score(row.get("score"))
        severity = _normalize_severity(row.get("severity"), sci)
        finding = row.get("finding") if isinstance(row.get("finding"), str) else ""
        hints = row.get("hints") if isinstance(row.get("hints"), list) else []
        hints_clean = [h for h in hints if isinstance(h, str)]
        out.append(
            {
                "id": req_id,
                "score": sci,
                "severity": severity,
                "finding": finding,
                "hints": hints_clean[:12],
            }
        )
    return out


def _generic_dimensions(rows: Any) -> list[dict[str, Any]]:
    out = []
    if not isinstance(rows, list):
        return out
    for item in rows:
        if not isinstance(item, dict):
            continue
        rid = item.get("id") or item.get("dimension")
        if not isinstance(rid, str):
            label = item.get("label")
            rid = _slug(str(label)) if isinstance(label, str) else None
        if not rid:
            continue
        label = item.get("label") if isinstance(item.get("label"), str) else rid.replace("_", " ").title()
        sci = _coerce_dimension_score(item.get("score"))
        sev = _normalize_severity(item.get("severity"), sci)
        finding = item.get("finding") if isinstance(item.get("finding"), str) else ""
        hints = (
            [h for h in item.get("hints", []) if isinstance(h, str)][:12]
            if isinstance(item.get("hints"), list)
            else []
        )
        out.append({"id": rid, "label": label, "score": sci, "severity": sev, "finding": finding, "hints": hints})
    return out[:50]


async def validate_generated_requirements(
    body: ValidateGeneratedRequirementsBody,
) -> dict[str, Any]:
    ctx = _truncate(body.document_context_snippet, 12000)
    peers = []
    for p in body.related_drafts[:60]:
        peers.append(p.model_dump(exclude_none=True))
    drafts = [d.model_dump(exclude_none=True) for d in body.drafts]
    payload = json.dumps(
        {"DRAFTS": drafts, "CONTEXT": ctx, "RELATED_DRAFTS": peers},
        indent=2,
        default=str,
    )[:60000]

    system_prompt = load_prompt("system/validation_requirement.txt")
    user_template = load_prompt("user/validation_requirement.txt")
    user_payload = user_template.format(draft_blob=payload)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]

    try:
        data = await chat_completion_json(messages=messages, temperature=0.15, profile=_VAL)
    except LLMConfigurationError:
        return _llm_dead("requirements", body.project_id)
    except LLMTransportError as e:
        return _llm_unreachable("requirements", body.project_id, str(e))
    except RuntimeError as e:
        return _llm_bad("requirements", body.project_id, str(e))

    return _finalize_response(
        data,
        "requirement_draft",
        body.project_id,
        body.organization_id,
        REQUIRED_IDS=REQUIREMENT_DIMENSION_IDS,
    )


async def validate_generated_test_cases(
    body: ValidateGeneratedTestCasesBody,
) -> dict[str, Any]:
    ctx = _truncate(body.document_context_snippet, 12000)
    tcds = [t.model_dump(mode="json") for t in body.test_case_drafts]
    srs = [s.model_dump(mode="json") for s in body.source_requirements[:100]]
    blob = json.dumps(
        {"TEST_CASE_DRAFTS": tcds, "SOURCE_REQUIREMENTS": srs, "CONTEXT": ctx},
        indent=2,
        default=str,
    )[:62000]

    system_prompt = load_prompt("system/validation_test_case.txt")
    user_template = load_prompt("user/validation_test_case.txt")
    user_payload = user_template.format(draft_blob=blob)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]

    try:
        data = await chat_completion_json(messages=messages, temperature=0.15, profile=_VAL)
    except LLMConfigurationError:
        return _llm_dead("test_case_draft", body.project_id)
    except LLMTransportError as e:
        return _llm_unreachable("test_case_draft", body.project_id, str(e))
    except RuntimeError as e:
        return _llm_bad("test_case_draft", body.project_id, str(e))

    return _finalize_response(
        data,
        "test_case_draft",
        body.project_id,
        body.organization_id,
        REQUIRED_IDS=TEST_CASE_DIMENSION_IDS,
        strict_perfect_score=True,
    )


async def validate_generated_test_scenarios(
    body: ValidateGeneratedTestScenariosBody,
) -> dict[str, Any]:
    ctx = _truncate(body.document_context_snippet, 12000)
    drafts = [d.model_dump(mode="json") for d in body.scenario_drafts]
    src = (
        body.source_requirement.model_dump(mode="json")
        if body.source_requirement is not None
        else None
    )
    peers = [p.model_dump(exclude_none=True) for p in body.related_scenario_drafts[:60]]
    blob = json.dumps(
        {
            "SCENARIO_DRAFTS": drafts,
            "SOURCE_REQUIREMENT": src,
            "RELATED_SCENARIO_DRAFTS": peers,
            "CONTEXT": ctx,
        },
        indent=2,
        default=str,
    )[:62000]

    system_prompt = load_prompt("system/validation_test_scenario.txt")
    user_template = load_prompt("user/validation_test_scenario.txt")
    user_payload = user_template.format(draft_blob=blob)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]

    try:
        data = await chat_completion_json(messages=messages, temperature=0.15, profile=_VAL)
    except LLMConfigurationError:
        return _llm_dead("test_scenario_draft", body.project_id)
    except LLMTransportError as e:
        return _llm_unreachable("test_scenario_draft", body.project_id, str(e))
    except RuntimeError as e:
        return _llm_bad("test_scenario_draft", body.project_id, str(e))

    return _finalize_response(
        data,
        "test_scenario_draft",
        body.project_id,
        body.organization_id,
        REQUIRED_IDS=TEST_SCENARIO_DIMENSION_IDS,
    )


async def validate_generic_artifact(
    body: ValidateGenericArtifactBody,
) -> dict[str, Any]:
    ctx = _truncate(body.context_snippet, 14000)
    summary = body.artifact_summary[:40000]
    checklist = ", ".join(f'"{c}"'[:200] for c in body.checklist)

    system_prompt = load_prompt("system/validation_generic.txt")
    user_template = load_prompt("user/validation_generic.txt")
    user_payload = user_template.format(
        artifact_type_json=json.dumps(body.artifact_type),
        checklist_blob=checklist,
        context_blob=ctx or "(none)",
        artifact_summary=summary,
    )[:63000]

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_payload},
    ]

    try:
        data = await chat_completion_json(messages=messages, temperature=0.2, profile=_VAL)
    except LLMConfigurationError:
        return _llm_dead("generic", body.project_id)
    except LLMTransportError as e:
        return _llm_unreachable("generic", body.project_id, str(e))
    except RuntimeError as e:
        return _llm_bad("generic", body.project_id, str(e))

    dims = _generic_dimensions(data.get("dimensions"))
    dim_scores = [float(d["score"]) for d in dims if isinstance(d.get("score"), int)]
    overall = _normalize_overall_score(data.get("overall_score"), dim_scores)
    summary_str = data.get("summary") if isinstance(data.get("summary"), str) else ""
    rec = data.get("recommendations") if isinstance(data.get("recommendations"), list) else []
    rec_c = [r for r in rec if isinstance(r, str)]

    return {
        "status": "ok",
        "model": resolved_chat_model(_VAL),
        "artifact_kind": "generic",
        "artifact_sub_type": body.artifact_type.strip(),
        "project_id": body.project_id,
        "organization_id": body.organization_id,
        "overall_score": overall,
        "summary": summary_str,
        "dimensions": dims,
        "recommendations": rec_c[:25],
    }


def _finalize_response(
    data: dict[str, Any],
    kind: str,
    project_id: int,
    organization_id: int | None,
    *,
    REQUIRED_IDS: list[str],
    strict_perfect_score: bool = False,
) -> dict[str, Any]:
    dims = _coerce_dimensions(data.get("dimensions"), REQUIRED_IDS)
    dim_scores = [float(d["score"]) for d in dims if isinstance(d.get("score"), int)]
    rec = data.get("recommendations") if isinstance(data.get("recommendations"), list) else []
    rec_c = [r for r in rec if isinstance(r, str)]
    ov = _normalize_overall_score(
        data.get("overall_score"),
        dim_scores,
        dimensions=dims if strict_perfect_score else None,
        recommendations=rec_c if strict_perfect_score else None,
        strict_perfect_score=strict_perfect_score,
    )
    summary_str = data.get("summary") if isinstance(data.get("summary"), str) else ""

    return {
        "status": "ok",
        "model": resolved_chat_model(_VAL),
        "artifact_kind": kind,
        "project_id": project_id,
        "organization_id": organization_id,
        "overall_score": ov,
        "summary": summary_str,
        "dimensions": dims,
        "recommendations": rec_c[:25],
    }


def _llm_dead(kind: str, project_id: int) -> dict[str, Any]:
    return {
        "status": "llm_unavailable",
        "model": resolved_chat_model(_VAL),
        "artifact_kind": kind,
        "project_id": project_id,
        "overall_score": None,
        "summary": "",
        "dimensions": [],
        "recommendations": [],
        "message": llm_setup_hint(),
    }


def _llm_unreachable(kind: str, project_id: int, msg: str) -> dict[str, Any]:
    return {
        "status": "llm_unreachable",
        "model": resolved_chat_model(_VAL),
        "artifact_kind": kind,
        "project_id": project_id,
        "overall_score": None,
        "summary": "",
        "dimensions": [],
        "recommendations": [],
        "message": msg,
    }


def _llm_bad(kind: str, project_id: int, msg: str) -> dict[str, Any]:
    return {
        "status": "llm_bad_response",
        "model": resolved_chat_model(_VAL),
        "artifact_kind": kind,
        "project_id": project_id,
        "overall_score": None,
        "summary": "",
        "dimensions": [],
        "recommendations": [],
        "message": msg,
    }
