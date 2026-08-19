"""Build compact few-shot example blocks for LLM prompt assembly.

These blocks provide stylistic and structural guidance only. They must not
override project-specific source excerpts, requirements, or scenarios.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.shared.example_loader import load_examples

logger = logging.getLogger(__name__)

_GUIDANCE_HEADER = (
    "Few-shot examples for guidance only. "
    "Do not copy values verbatim unless supported by the project source."
)

_MAX_EXAMPLES_PER_FILE = 2

_REQUIREMENT_EXAMPLE_FILES: dict[str, str] = {
    "BRD": "requirements/brd_requirement_examples.yaml",
    "FRD": "requirements/frd_requirement_examples.yaml",
    "SRS": "requirements/srs_requirement_examples.yaml",
    "HLR": "requirements/hlr_requirement_examples.yaml",
    "LLR": "requirements/llr_requirement_examples.yaml",
}

_SCENARIO_EXAMPLE_FILES: tuple[tuple[str, str], ...] = (
    ("Functional scenarios", "test_scenarios/functional_scenario_examples.yaml"),
    ("Workflow scenarios", "test_scenarios/workflow_scenario_examples.yaml"),
    (
        "Negative, boundary, and validation scenarios",
        "test_scenarios/negative_boundary_validation_scenario_examples.yaml",
    ),
)

_TEST_CASE_EXAMPLE_FILES: tuple[tuple[str, str, bool], ...] = (
    ("Manual test cases", "test_cases/manual_test_case_examples.yaml", True),
    (
        "Data validation test cases",
        "test_cases/data_validation_test_case_examples.yaml",
        True,
    ),
    ("API test cases", "test_cases/api_test_case_examples.yaml", False),
)

_API_KEYWORDS = (
    "api",
    "endpoint",
    "request",
    "response",
    "rest",
    "http",
    "payload",
    "status code",
)

_DOC_TYPE_PATTERN = re.compile(
    r"\b(LLR|HLR|SRS|FRD|FRS|BRD)\b",
    re.IGNORECASE,
)


def detect_document_type_from_context(context: str | None) -> str | None:
    """Best-effort document type token from RAG or document excerpt text."""
    if not context or not str(context).strip():
        return None
    match = _DOC_TYPE_PATTERN.search(str(context))
    if not match:
        return None
    token = match.group(1).upper()
    if token == "FRS":
        return "FRD"
    return token


def context_suggests_api(*texts: str | None) -> bool:
    """Return True when supplied text clearly references API-style testing."""
    combined = " ".join(str(text or "") for text in texts).lower()
    return any(keyword in combined for keyword in _API_KEYWORDS)


def _normalize_document_type(document_type: str | None) -> str:
    token = str(document_type or "").strip().upper()
    if token == "FRS":
        return "FRD"
    if token in _REQUIREMENT_EXAMPLE_FILES:
        return token
    return "BRD"


def _safe_examples(
    relative_path: str,
    limit: int = _MAX_EXAMPLES_PER_FILE,
) -> list[dict[str, Any]]:
    try:
        data = load_examples(relative_path)
    except (FileNotFoundError, ValueError, OSError) as exc:
        logger.warning(
            "Skipping few-shot examples from %s: %s",
            relative_path,
            exc,
        )
        return []

    examples = data.get("examples") or []
    selected: list[dict[str, Any]] = []
    for item in examples:
        if isinstance(item, dict):
            selected.append(item)
        if len(selected) >= limit:
            break
    return selected


def _format_mapping(prefix: str, mapping: dict[str, Any]) -> list[str]:
    lines = [prefix]
    for key, value in mapping.items():
        if value is None:
            continue
        if isinstance(value, (dict, list)):
            rendered = json.dumps(value, ensure_ascii=False, indent=2)
        else:
            rendered = str(value)
        lines.append(f"- {key}: {rendered}")
    return lines


def _format_requirement_example(example: dict[str, Any]) -> str:
    ex_id = example.get("example_id", "example")
    source = str(example.get("source_excerpt") or "").strip()
    expected = example.get("expected_output") or {}
    lines = [f"Example {ex_id}:", f"Source excerpt: {source}", "Expected output:"]
    if isinstance(expected, dict):
        lines.extend(_format_mapping("", expected)[1:])
    return "\n".join(lines)


def _format_scenario_example(example: dict[str, Any]) -> str:
    ex_id = example.get("example_id", "example")
    source = example.get("source_requirement") or {}
    expected = example.get("expected_output") or {}
    lines = [f"Example {ex_id}:"]
    if isinstance(source, dict):
        lines.extend(_format_mapping("Source requirement:", source))
    lines.append("Expected output:")
    if isinstance(expected, dict):
        lines.extend(_format_mapping("", expected)[1:])
    return "\n".join(lines)


def _truncate_test_steps(steps: Any, limit: int = 3) -> Any:
    if not isinstance(steps, list):
        return steps
    if len(steps) <= limit:
        return steps
    trimmed = steps[:limit]
    return trimmed + [{"note": f"...{len(steps) - limit} more step(s) omitted in example"}]


def _format_test_case_example(example: dict[str, Any]) -> str:
    ex_id = example.get("example_id", "example")
    source = example.get("source_scenario") or {}
    expected = dict(example.get("expected_output") or {})
    if "test_steps" in expected:
        expected["test_steps"] = _truncate_test_steps(expected.get("test_steps"))
    lines = [f"Example {ex_id}:"]
    if isinstance(source, dict):
        lines.extend(_format_mapping("Source scenario:", source))
    lines.append("Expected output:")
    if expected:
        lines.extend(_format_mapping("", expected)[1:])
    return "\n".join(lines)


def _build_section(title: str, relative_path: str, formatter) -> str:
    examples = _safe_examples(relative_path)
    if not examples:
        return ""
    rendered = "\n\n".join(formatter(example) for example in examples)
    return f"{title}:\n{rendered}"


def _assemble_block(sections: list[str]) -> str:
    kept = [section.strip() for section in sections if section and section.strip()]
    if not kept:
        return ""
    return f"{_GUIDANCE_HEADER}\n\n" + "\n\n".join(kept)


def build_requirement_examples_block(document_type: str | None = None) -> str:
    """Build a compact few-shot block for requirement generation prompts."""
    doc_type = _normalize_document_type(document_type)
    relative_path = _REQUIREMENT_EXAMPLE_FILES[doc_type]
    section = _build_section(
        f"Requirement generation examples ({doc_type})",
        relative_path,
        _format_requirement_example,
    )
    return _assemble_block([section])


def build_scenario_examples_block() -> str:
    """Build a compact few-shot block for test scenario generation prompts."""
    sections = [
        _build_section(title, relative_path, _format_scenario_example)
        for title, relative_path in _SCENARIO_EXAMPLE_FILES
    ]
    return _assemble_block(sections)


def build_test_case_examples_block(include_api_examples: bool = False) -> str:
    """Build a compact few-shot block for test case generation prompts."""
    sections: list[str] = []
    for title, relative_path, always_include in _TEST_CASE_EXAMPLE_FILES:
        if always_include or include_api_examples:
            section = _build_section(title, relative_path, _format_test_case_example)
            if section:
                sections.append(section)
    return _assemble_block(sections)
