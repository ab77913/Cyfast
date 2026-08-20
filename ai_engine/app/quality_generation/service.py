from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .schemas import (
    GenerationItem,
    GenerationStage,
    GenerationValidationError,
    SOURCE_TYPE_BY_STAGE,
    STAGE_ITEM_TYPE,
    validate_generation_output,
)


MAX_SOURCE_CHARACTERS = 600_000
MAX_SOURCE_ITEMS = 500


class QualityGenerationUnavailable(RuntimeError):
    pass


class QualityGenerationResponseError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class GenerationResult:
    stage: GenerationStage
    items: tuple[GenerationItem, ...]
    model: str
    prompt_version: str
    source_item_count: int
    source_character_count: int
    warnings: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "stage": self.stage.value,
            "item_type": STAGE_ITEM_TYPE[self.stage],
            "items": [item.to_dict() for item in self.items],
            "model": self.model,
            "prompt_version": self.prompt_version,
            "source_item_count": self.source_item_count,
            "source_character_count": self.source_character_count,
            "warnings": list(self.warnings),
            "approval_required": True,
        }


class QualityGenerationService:
    prompt_version = "quality-generation-v1.0"

    def __init__(
        self,
        *,
        endpoint: str | None = None,
        model: str | None = None,
        timeout_seconds: int = 240,
    ) -> None:
        self.endpoint = (
            endpoint
            or os.environ.get("CYFAST_LOCAL_LLM_URL")
            or "http://127.0.0.1:11434/api/chat"
        ).strip()
        self.model = (
            model
            or os.environ.get("CYFAST_QUALITY_GENERATION_MODEL")
            or os.environ.get("CYFAST_SCRIPT_REPAIR_MODEL")
            or "qwen3:14b"
        ).strip()
        self.timeout_seconds = max(30, min(int(timeout_seconds), 600))
        self._validate_endpoint()

    def generate(
        self,
        *,
        stage: GenerationStage | str,
        source_items: Sequence[Mapping[str, Any]],
        platform: str | None = None,
        context: Mapping[str, Any] | None = None,
        generation_policy: Mapping[str, Any] | None = None,
    ) -> GenerationResult:
        stage_value = stage if isinstance(stage, GenerationStage) else GenerationStage.parse(str(stage))
        normalized_sources, source_characters = self._normalize_sources(stage_value, source_items)
        normalized_platform = str(platform or "").strip().upper() or None
        request_body = self._request_body(
            stage=stage_value,
            source_items=normalized_sources,
            platform=normalized_platform,
            context=redact(context or {}),
            generation_policy=redact(generation_policy or {}),
        )
        response = self._invoke(request_body)
        content = extract_content(response)
        parsed = parse_json_object(content)
        try:
            items = validate_generation_output(
                stage_value,
                parsed,
                source_items=normalized_sources,
                platform=normalized_platform,
            )
        except GenerationValidationError as exc:
            raise QualityGenerationResponseError("Generated content failed schema validation: " + " | ".join(exc.errors)) from exc
        return GenerationResult(
            stage=stage_value,
            items=items,
            model=self.model,
            prompt_version=self.prompt_version,
            source_item_count=len(normalized_sources),
            source_character_count=source_characters,
            warnings=tuple(str(value) for value in parsed.get("warnings", []) if str(value).strip())
            if isinstance(parsed.get("warnings"), list)
            else (),
        )

    def _normalize_sources(
        self,
        stage: GenerationStage,
        source_items: Sequence[Mapping[str, Any]],
    ) -> tuple[list[dict[str, Any]], int]:
        if not isinstance(source_items, Sequence) or isinstance(source_items, (str, bytes, bytearray)):
            raise ValueError("source_items must be an array")
        if not source_items or len(source_items) > MAX_SOURCE_ITEMS:
            raise ValueError(f"source_items must contain 1-{MAX_SOURCE_ITEMS} items")
        allowed_types = SOURCE_TYPE_BY_STAGE[stage]
        output: list[dict[str, Any]] = []
        total_characters = 0
        for index, item in enumerate(source_items, start=1):
            if not isinstance(item, Mapping):
                raise ValueError(f"source_items[{index}] must be an object")
            item_type = str(item.get("item_type") or item.get("type") or "").upper()
            if item_type not in allowed_types:
                raise ValueError(
                    f"source_items[{index}] type {item_type or '<empty>'} is not valid for {stage.value}"
                )
            resource_id = str(item.get("resource_id") or item.get("id") or "").strip()
            if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", resource_id):
                raise ValueError(f"source_items[{index}].resource_id is invalid")
            content = item.get("content")
            if isinstance(content, str):
                normalized_content: Any = content
            elif isinstance(content, Mapping) or isinstance(content, list):
                normalized_content = json.loads(json.dumps(content, ensure_ascii=False, default=str))
            else:
                raise ValueError(f"source_items[{index}].content is required")
            characters = len(
                normalized_content
                if isinstance(normalized_content, str)
                else json.dumps(normalized_content, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            )
            total_characters += characters
            if total_characters > MAX_SOURCE_CHARACTERS:
                raise ValueError(f"source content exceeds {MAX_SOURCE_CHARACTERS} characters")
            output.append(
                {
                    "item_type": item_type,
                    "resource_id": resource_id,
                    "resource_version": str(item.get("resource_version") or item.get("version") or "current"),
                    "title": str(item.get("title") or resource_id)[:512],
                    "source_anchor": redact(item.get("source_anchor") or {}),
                    "content": redact(normalized_content),
                }
            )
        return output, total_characters

    def _request_body(
        self,
        *,
        stage: GenerationStage,
        source_items: Sequence[Mapping[str, Any]],
        platform: str | None,
        context: Mapping[str, Any],
        generation_policy: Mapping[str, Any],
    ) -> dict[str, Any]:
        system = _system_prompt(stage)
        user = {
            "task": _task(stage),
            "stage": stage.value,
            "output_item_type": STAGE_ITEM_TYPE[stage],
            "platform": platform,
            "source_items": source_items,
            "context": context,
            "generation_policy": generation_policy,
            "required_rules": [
                "Every item must contain source_resource_ids and a non-empty source_anchor.",
                "Do not invent real execution results, screenshots, recordings, protocol traces, defects, or PASS status.",
                "Do not include plaintext credentials; use environment or secret references.",
                "Do not include TODOs, placeholders, arbitrary shell execution, or unresolved host-specific paths.",
                "Return valid JSON only, with a top-level items array and optional warnings array.",
            ],
            "response_schema": _response_schema(stage, platform),
        }
        return {
            "model": self.model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False, sort_keys=True)},
            ],
            "options": {
                "temperature": 0.1,
                "top_p": 0.85,
                "num_predict": 16_384,
            },
        }

    def _invoke(self, body: Mapping[str, Any]) -> Mapping[str, Any]:
        request = urllib.request.Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            method="POST",
            headers={"content-type": "application/json", "accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = response.read(32 * 1024 * 1024)
                if response.status < 200 or response.status >= 300:
                    raise QualityGenerationUnavailable(f"Local generation model returned HTTP {response.status}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise QualityGenerationUnavailable(f"Local quality-generation model is unavailable: {exc}") from exc
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise QualityGenerationResponseError("Local model returned invalid JSON") from exc
        if not isinstance(value, Mapping):
            raise QualityGenerationResponseError("Local model response must be an object")
        return value

    def _validate_endpoint(self) -> None:
        if not re.fullmatch(
            r"https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?/[A-Za-z0-9_./-]+",
            self.endpoint,
            re.I,
        ):
            raise ValueError("CYFAST_LOCAL_LLM_URL must be an absolute loopback HTTP(S) endpoint")


def _system_prompt(stage: GenerationStage) -> str:
    common = """You are the CyFAST safety-conscious quality engineering generator.
Generate only the requested lifecycle stage. Preserve source traceability and deterministic structure.
Never claim that generated content has been executed or passed. Never fabricate target readiness or evidence.
Return JSON only. Do not include markdown fences or explanations outside JSON."""
    specifics = {
        GenerationStage.REQUIREMENTS: "Extract atomic, testable business, functional, non-functional, safety, interface, security, performance, and compliance requirements. Identify ambiguity as content metadata rather than guessing silently.",
        GenerationStage.TEST_SCENARIOS: "Create positive, negative, boundary, failure, recovery, security, performance, compliance, compatibility, and usability scenarios that verify approved requirements.",
        GenerationStage.TEST_CASES: "Create executable test cases with explicit preconditions, ordered actions, test data references, and expected results. Every case must map to a source scenario.",
        GenerationStage.TEST_DATA: "Create valid, invalid, boundary, security, configuration, protocol, and recovery data. Use secret_references instead of credentials.",
        GenerationStage.LOGICAL_STEPS: "Create platform-independent ordered actions and assertions. Do not introduce implementation-specific locators or commands unless they are supplied in approved bindings.",
        GenerationStage.TEST_SCRIPTS: "Generate complete Robot Framework scripts for the selected platform using only supplied approved application/device profiles, locator sets, target profiles, logical steps, and data references. Retain every business action and assertion. Use semantic locators before coordinates.",
    }
    return common + "\n" + specifics[stage]


def _task(stage: GenerationStage) -> str:
    return {
        GenerationStage.REQUIREMENTS: "Generate testable requirements from the uploaded source document",
        GenerationStage.TEST_SCENARIOS: "Generate complete scenario coverage from approved requirements and risks",
        GenerationStage.TEST_CASES: "Generate detailed test cases from approved scenarios",
        GenerationStage.TEST_DATA: "Generate versioned test data from approved test cases",
        GenerationStage.LOGICAL_STEPS: "Generate platform-independent logical automation steps",
        GenerationStage.TEST_SCRIPTS: "Generate validated Robot Framework test scripts for the selected real platform",
    }[stage]


def _response_schema(stage: GenerationStage, platform: str | None) -> Mapping[str, Any]:
    common = {
        "resource_id": "safe stable ID or omit for server-generated ID",
        "resource_version": "version string, default 1",
        "item_type": STAGE_ITEM_TYPE[stage],
        "title": "descriptive title",
        "source_resource_ids": ["one or more supplied source resource IDs"],
        "source_anchor": {"source_item": "ID", "section": "source section", "reference": "precise source reference"},
        "content": {},
    }
    content = {
        GenerationStage.REQUIREMENTS: {
            "description": "atomic requirement statement",
            "requirement_type": "BUSINESS|FUNCTIONAL|NON_FUNCTIONAL|SAFETY|INTERFACE|SECURITY|PERFORMANCE|COMPLIANCE",
            "acceptance_criteria": ["measurable criterion"],
            "priority": "LOW|MEDIUM|HIGH|CRITICAL",
            "ambiguities": [],
            "risks": [],
        },
        GenerationStage.TEST_SCENARIOS: {
            "objective": "scenario objective",
            "category": "POSITIVE|NEGATIVE|BOUNDARY|FAILURE|RECOVERY|SECURITY|PERFORMANCE|COMPLIANCE|COMPATIBILITY|USABILITY",
            "preconditions": [],
            "expected_outcome": "observable outcome",
            "platforms": [platform or "WINDOWS"],
            "required_capabilities": [],
        },
        GenerationStage.TEST_CASES: {
            "preconditions": [],
            "steps": [{"order": 1, "action": "action", "test_data_reference": "TD-ID", "expected_result": "observable result"}],
            "postconditions": [],
            "priority": "LOW|MEDIUM|HIGH|CRITICAL",
            "automation_feasibility": "AUTOMATABLE|PARTIAL|MANUAL",
            "required_capabilities": [],
        },
        GenerationStage.TEST_DATA: {
            "category": "VALID|INVALID|BOUNDARY|SECURITY|CONFIGURATION|PROTOCOL|RECOVERY",
            "values": {},
            "secret_references": {},
            "constraints": [],
        },
        GenerationStage.LOGICAL_STEPS: {
            "steps": [{"order": 1, "action": "platform-independent action", "assertion": "observable assertion", "data_reference": "TD-ID"}],
            "required_capabilities": [],
        },
        GenerationStage.TEST_SCRIPTS: {
            "platform": platform,
            "filename": "safe-name.robot",
            "script": "complete Robot Framework script",
            "suite_path": "safe-name.robot",
            "required_capabilities": [],
            "application_profile_reference": "approved profile ID",
            "locator_set_reference": "approved locator set ID",
            "environment_references": {},
        },
    }[stage]
    return {"items": [{**common, "content": content}], "warnings": []}


def extract_content(value: Mapping[str, Any]) -> str:
    message = value.get("message")
    if isinstance(message, Mapping) and isinstance(message.get("content"), str):
        return message["content"]
    if isinstance(value.get("response"), str):
        return value["response"]
    raise QualityGenerationResponseError("Local model response does not contain message.content or response")


def parse_json_object(value: str) -> Mapping[str, Any]:
    text = value.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise QualityGenerationResponseError("Generation content is not valid JSON") from exc
    if not isinstance(parsed, Mapping):
        raise QualityGenerationResponseError("Generation content must be a JSON object")
    return parsed


def redact(value: Any) -> Any:
    if isinstance(value, list):
        return [redact(item) for item in value]
    if not isinstance(value, Mapping):
        return value
    output: dict[str, Any] = {}
    for key, item in value.items():
        if re.search(r"password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key", str(key), re.I):
            output[str(key)] = "[REDACTED]"
        else:
            output[str(key)] = redact(item)
    return output


_service: QualityGenerationService | None = None


def get_quality_generation_service() -> QualityGenerationService:
    global _service
    if _service is None:
        _service = QualityGenerationService()
    return _service
