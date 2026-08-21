from __future__ import annotations

import enum
import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence


class GenerationStage(str, enum.Enum):
    REQUIREMENTS = "REQUIREMENTS"
    TEST_SCENARIOS = "TEST_SCENARIOS"
    TEST_CASES = "TEST_CASES"
    TEST_DATA = "TEST_DATA"
    LOGICAL_STEPS = "LOGICAL_STEPS"
    TEST_SCRIPTS = "TEST_SCRIPTS"

    @classmethod
    def parse(cls, value: str) -> "GenerationStage":
        try:
            return cls(str(value or "").strip().upper())
        except ValueError as exc:
            raise ValueError(f"Unsupported generation stage: {value!r}") from exc


STAGE_ITEM_TYPE = {
    GenerationStage.REQUIREMENTS: "REQUIREMENT",
    GenerationStage.TEST_SCENARIOS: "TEST_SCENARIO",
    GenerationStage.TEST_CASES: "TEST_CASE",
    GenerationStage.TEST_DATA: "TEST_DATA",
    GenerationStage.LOGICAL_STEPS: "LOGICAL_STEP",
    GenerationStage.TEST_SCRIPTS: "TEST_SCRIPT",
}


SOURCE_TYPE_BY_STAGE = {
    GenerationStage.REQUIREMENTS: {"DOCUMENT"},
    GenerationStage.TEST_SCENARIOS: {"REQUIREMENT", "RISK"},
    GenerationStage.TEST_CASES: {"TEST_SCENARIO"},
    GenerationStage.TEST_DATA: {"TEST_CASE"},
    GenerationStage.LOGICAL_STEPS: {"TEST_CASE", "TEST_DATA"},
    GenerationStage.TEST_SCRIPTS: {"LOGICAL_STEP", "TEST_CASE", "TEST_DATA", "APPLICATION", "DEVICE", "LOCATOR_SET", "TARGET_PROFILE", "AUTOMATION_PROJECT_PROFILE"},
}


ALLOWED_SCENARIO_CATEGORIES = {
    "POSITIVE",
    "NEGATIVE",
    "BOUNDARY",
    "FAILURE",
    "RECOVERY",
    "SECURITY",
    "PERFORMANCE",
    "COMPLIANCE",
    "COMPATIBILITY",
    "USABILITY",
}
ALLOWED_PLATFORMS = {"WINDOWS", "LINUX", "ANDROID", "EMBEDDED"}
ACTION_KEYWORDS = (
    "click element",
    "click button",
    "input text",
    "press keys",
    "select from list",
    "set value",
    "invoke element",
    "open application",
    "launch application",
    "tap",
    "send frame",
    "write uart",
    "start measurement",
    "run keyword",
)
ASSERTION_KEYWORDS = (
    "element should",
    "page should",
    "should be equal",
    "should contain",
    "should be true",
    "wait until element is visible",
    "response should",
    "verify signal",
    "assert",
)


class GenerationValidationError(ValueError):
    def __init__(self, errors: Sequence[str]) -> None:
        self.errors = list(errors)
        super().__init__(" | ".join(self.errors))


@dataclass(frozen=True, slots=True)
class GenerationItem:
    resource_id: str
    resource_version: str
    item_type: str
    title: str
    source_resource_ids: tuple[str, ...]
    source_anchor: Mapping[str, Any]
    content: Mapping[str, Any]
    content_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "resource_id": self.resource_id,
            "resource_version": self.resource_version,
            "item_type": self.item_type,
            "title": self.title,
            "source_resource_ids": list(self.source_resource_ids),
            "source_anchor": dict(self.source_anchor),
            "content": dict(self.content),
            "content_hash": self.content_hash,
        }


def validate_generation_output(
    stage: GenerationStage,
    value: Mapping[str, Any],
    *,
    source_items: Sequence[Mapping[str, Any]],
    platform: str | None = None,
) -> tuple[GenerationItem, ...]:
    raw_items = value.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise GenerationValidationError(["Generation response must contain a non-empty items array"])
    if len(raw_items) > 250:
        raise GenerationValidationError(["Generation response contains more than 250 items"])

    source_ids = {
        str(item.get("resource_id"))
        for item in source_items
        if item.get("resource_id") is not None
    }
    expected_type = STAGE_ITEM_TYPE[stage]
    output: list[GenerationItem] = []
    errors: list[str] = []
    seen_hashes: set[str] = set()
    seen_ids: set[str] = set()
    normalized_platform = str(platform or "").upper() or None

    for index, raw in enumerate(raw_items, start=1):
        if not isinstance(raw, Mapping):
            errors.append(f"Item {index} must be an object")
            continue
        try:
            item = _validate_item(
                stage,
                expected_type,
                raw,
                source_ids=source_ids,
                platform=normalized_platform,
                position=index,
            )
        except GenerationValidationError as exc:
            errors.extend(f"Item {index}: {message}" for message in exc.errors)
            continue
        if item.resource_id in seen_ids:
            errors.append(f"Item {index}: duplicate resource_id {item.resource_id}")
            continue
        if item.content_hash in seen_hashes:
            continue
        seen_ids.add(item.resource_id)
        seen_hashes.add(item.content_hash)
        output.append(item)

    if errors:
        raise GenerationValidationError(errors)
    if not output:
        raise GenerationValidationError(["All generated items were duplicates or invalid"])
    return tuple(output)


def _validate_item(
    stage: GenerationStage,
    expected_type: str,
    raw: Mapping[str, Any],
    *,
    source_ids: set[str],
    platform: str | None,
    position: int,
) -> GenerationItem:
    errors: list[str] = []
    title = _text(raw.get("title") or raw.get("name"), 3, 512, "title", errors)
    resource_id = _safe_resource_id(raw.get("resource_id")) or _generated_id(expected_type)
    resource_version = _safe_version(raw.get("resource_version") or "1")
    item_type = str(raw.get("item_type") or expected_type).upper()
    if item_type != expected_type:
        errors.append(f"item_type must be {expected_type}")

    raw_sources = raw.get("source_resource_ids") or raw.get("source_ids") or []
    if isinstance(raw_sources, str):
        raw_sources = [raw_sources]
    if not isinstance(raw_sources, list):
        errors.append("source_resource_ids must be an array")
        raw_sources = []
    normalized_sources = tuple(dict.fromkeys(str(value) for value in raw_sources if str(value).strip()))
    if not normalized_sources:
        errors.append("At least one source_resource_id is required")
    unknown = [value for value in normalized_sources if source_ids and value not in source_ids]
    if unknown:
        errors.append(f"Unknown source_resource_ids: {', '.join(unknown)}")

    source_anchor = raw.get("source_anchor")
    if not isinstance(source_anchor, Mapping) or not source_anchor:
        errors.append("source_anchor must be a non-empty object")
        source_anchor = {}
    content = raw.get("content") if isinstance(raw.get("content"), Mapping) else {
        key: value
        for key, value in raw.items()
        if key not in {"resource_id", "resource_version", "item_type", "title", "name", "source_resource_ids", "source_ids", "source_anchor"}
    }
    if not content:
        errors.append("content must be a non-empty object")

    if stage is GenerationStage.REQUIREMENTS:
        _validate_requirement(content, errors)
    elif stage is GenerationStage.TEST_SCENARIOS:
        _validate_scenario(content, errors)
    elif stage is GenerationStage.TEST_CASES:
        _validate_test_case(content, errors)
    elif stage is GenerationStage.TEST_DATA:
        _validate_test_data(content, errors)
    elif stage is GenerationStage.LOGICAL_STEPS:
        _validate_logical_steps(content, errors)
    elif stage is GenerationStage.TEST_SCRIPTS:
        _validate_script(content, platform, errors)

    if errors:
        raise GenerationValidationError(errors)
    normalized_content = _normalize_json(content)
    content_hash = hashlib.sha256(
        json.dumps(normalized_content, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).hexdigest()
    return GenerationItem(
        resource_id=resource_id,
        resource_version=resource_version,
        item_type=item_type,
        title=title,
        source_resource_ids=normalized_sources,
        source_anchor=_normalize_json(source_anchor),
        content=normalized_content,
        content_hash=content_hash,
    )


def _validate_requirement(content: Mapping[str, Any], errors: list[str]) -> None:
    _text(content.get("description"), 10, 20_000, "description", errors)
    criteria = content.get("acceptance_criteria")
    if not isinstance(criteria, list) or not criteria or any(not str(value).strip() for value in criteria):
        errors.append("acceptance_criteria must be a non-empty array")
    requirement_type = str(content.get("requirement_type") or content.get("type") or "FUNCTIONAL").upper()
    if requirement_type not in {"BUSINESS", "FUNCTIONAL", "NON_FUNCTIONAL", "SAFETY", "INTERFACE", "SECURITY", "PERFORMANCE", "COMPLIANCE"}:
        errors.append("requirement_type is invalid")


def _validate_scenario(content: Mapping[str, Any], errors: list[str]) -> None:
    _text(content.get("objective"), 10, 20_000, "objective", errors)
    category = str(content.get("category") or "").upper()
    if category not in ALLOWED_SCENARIO_CATEGORIES:
        errors.append("scenario category is invalid")
    platforms = content.get("platforms")
    if not isinstance(platforms, list) or not platforms:
        errors.append("platforms must be a non-empty array")
    elif any(str(value).upper() not in ALLOWED_PLATFORMS for value in platforms):
        errors.append("platforms contains an unsupported platform")
    _text(content.get("expected_outcome"), 3, 20_000, "expected_outcome", errors)


def _validate_test_case(content: Mapping[str, Any], errors: list[str]) -> None:
    steps = content.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("steps must be a non-empty array")
        return
    if len(steps) > 200:
        errors.append("test case contains more than 200 steps")
    for index, step in enumerate(steps, start=1):
        if not isinstance(step, Mapping):
            errors.append(f"step {index} must be an object")
            continue
        _text(step.get("action"), 2, 4096, f"step {index} action", errors)
        _text(step.get("expected_result"), 2, 4096, f"step {index} expected_result", errors)


def _validate_test_data(content: Mapping[str, Any], errors: list[str]) -> None:
    category = str(content.get("category") or "").upper()
    if category not in {"VALID", "INVALID", "BOUNDARY", "SECURITY", "CONFIGURATION", "PROTOCOL", "RECOVERY"}:
        errors.append("test data category is invalid")
    if "values" not in content and "secret_references" not in content:
        errors.append("test data requires values or secret_references")
    if _contains_plaintext_secret(content):
        errors.append("test data contains a possible plaintext secret")


def _validate_logical_steps(content: Mapping[str, Any], errors: list[str]) -> None:
    steps = content.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("logical steps must be a non-empty array")
        return
    actions = 0
    assertions = 0
    for index, step in enumerate(steps, start=1):
        if not isinstance(step, Mapping):
            errors.append(f"logical step {index} must be an object")
            continue
        action = str(step.get("action") or "").strip()
        assertion = str(step.get("assertion") or "").strip()
        if action:
            actions += 1
        if assertion:
            assertions += 1
    if actions < 1:
        errors.append("logical steps require at least one action")
    if assertions < 1:
        errors.append("logical steps require at least one assertion")


def _validate_script(content: Mapping[str, Any], platform: str | None, errors: list[str]) -> None:
    script = str(content.get("script") or content.get("content") or "")
    filename = str(content.get("suite_path") or content.get("filename") or "")
    script_platform = str(content.get("platform") or platform or "").upper()
    project_mode = str(content.get("project_mode") or "").upper()
    operation = str(content.get("operation") or "").upper()
    if script_platform not in ALLOWED_PLATFORMS:
        errors.append("script platform is invalid")
    if project_mode not in {"NEW", "EXISTING"}:
        errors.append("project_mode must be NEW or EXISTING")
    if operation not in {"CREATE", "UPDATE"}:
        errors.append("operation must be CREATE or UPDATE")
    if project_mode == "NEW" and operation != "CREATE":
        errors.append("NEW projects may only CREATE the root suite")
    if not _safe_project_path(filename, {".robot"}):
        errors.append("suite_path must be a safe relative .robot path")
    if len(script) < 20 or len(script.encode("utf-8")) > 225_280:
        errors.append("Robot script size is invalid")
        return
    lowered = script.lower()
    if not _contains_robot_keyword(script, ACTION_KEYWORDS):
        errors.append("Robot script has no meaningful action")
    if not _contains_robot_keyword(script, ASSERTION_KEYWORDS):
        errors.append("Robot script has no meaningful assertion")
    if re.search(r"^\s*(?:#\s*)?(?:TODO|FIXME)\b", script, re.I | re.M) or re.search(
        r"<locator>|replace_me|your_locator|placeholder_locator", script, re.I
    ):
        errors.append("Robot script contains unresolved placeholders")
    if re.search(r"^\s*(?:Run|Run Process|Start Process)\s{2,}(?:powershell|cmd(?:\.exe)?|bash|sh)\b", script, re.I | re.M):
        errors.append("Robot script contains arbitrary shell execution")
    if re.search(r"\bdesiredCapabilities\b", script, re.I):
        errors.append("Robot script contains legacy Appium capabilities")
    if re.search(r"^\s*\$\{(?:PASSWORD|TOKEN|SECRET|API_KEY)\}\s{2,}(?!%\{|\$\{)[^#\s].+$", script, re.I | re.M):
        errors.append("Robot script contains a possible plaintext credential")
    if re.search(r"(?:^|[\s\"'])(?:/home/|/tmp/|/var/tmp/)", script, re.I) or re.search(
        r"(?:^|[\s\"'])[A-Za-z]:\\", script
    ):
        errors.append("Robot script contains an unresolved host-specific path")

    resource_files = content.get("resource_files") or []
    if not isinstance(resource_files, list):
        errors.append("resource_files must be an array")
        resource_files = []
    if len(resource_files) > 127:
        errors.append("resource_files contains more than 127 files")
    seen_paths = {filename.lower()} if filename else set()
    generated_package_bytes = len(script.encode("utf-8"))
    for index, file_value in enumerate(resource_files, start=1):
        if not isinstance(file_value, Mapping):
            errors.append(f"resource file {index} must be an object")
            continue
        file_path = str(file_value.get("path") or "")
        file_operation = str(file_value.get("operation") or "CREATE").upper()
        file_content = file_value.get("content")
        if not _safe_project_path(file_path):
            errors.append(f"resource file {index} path is unsafe")
        elif file_path.lower() in seen_paths:
            errors.append(f"duplicate package path: {file_path}")
        else:
            seen_paths.add(file_path.lower())
        if file_operation not in {"CREATE", "UPDATE"}:
            errors.append(f"resource file {index} operation must be CREATE or UPDATE")
        if not isinstance(file_content, str) or not file_content.strip():
            errors.append(f"resource file {index} content is required")
        elif len(file_content.encode("utf-8")) > 225_280:
            errors.append(f"resource file {index} exceeds the package size limit")
        else:
            generated_package_bytes += len(file_content.encode("utf-8"))

    reused_paths = content.get("reused_file_paths") or []
    if not isinstance(reused_paths, list):
        errors.append("reused_file_paths must be an array")
        reused_paths = []
    if project_mode == "NEW" and reused_paths:
        errors.append("NEW projects cannot reuse existing files")
    for index, file_path in enumerate(reused_paths, start=1):
        normalized = str(file_path or "")
        if not _safe_project_path(normalized):
            errors.append(f"reused file {index} path is unsafe")
        elif normalized.lower() in seen_paths:
            errors.append(f"duplicate package path: {normalized}")
        else:
            seen_paths.add(normalized.lower())
    if generated_package_bytes > 225_280:
        errors.append("generated package content exceeds 225280 bytes")


def _safe_project_path(value: str, extensions: set[str] | None = None) -> bool:
    if not value or len(value) > 512 or "\\" in value or value.startswith(("/", "~")):
        return False
    parts = value.split("/")
    if any(not part or part in {".", ".."} or not re.fullmatch(r"[A-Za-z0-9._@+-]{1,128}", part) for part in parts):
        return False
    suffix = "." + parts[-1].rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
    allowed = extensions or {".robot", ".resource", ".py", ".json", ".yaml", ".yml", ".txt", ".csv", ".xml"}
    return suffix in allowed


def _contains_robot_keyword(script: str, candidates: Sequence[str]) -> bool:
    """Match invoked Robot keywords, not test names or free-form text."""
    for raw_line in script.splitlines():
        if not raw_line[:1].isspace():
            continue
        stripped = raw_line.strip()
        if not stripped or stripped.startswith(("#", "[")):
            continue
        cells = [cell.strip() for cell in re.split(r"\s{2,}|\t+", stripped) if cell.strip()]
        if not cells:
            continue
        if len(cells) > 1 and re.fullmatch(r"\$\{[^}]+\}\s*=", cells[0]):
            cells = cells[1:]
        if not cells:
            continue
        invoked = cells[0].lower()
        if any(invoked == candidate or invoked.startswith(candidate + " ") for candidate in candidates):
            return True
    return False


def _contains_plaintext_secret(value: Any, parent_key: str = "") -> bool:
    if isinstance(value, list):
        return any(_contains_plaintext_secret(item, parent_key) for item in value)
    if not isinstance(value, Mapping):
        return bool(
            re.search(r"password|passwd|secret|token|api[_-]?key", parent_key, re.I)
            and str(value).strip()
            and not str(value).startswith(("%{", "${", "env:", "secret:"))
        )
    return any(_contains_plaintext_secret(item, str(key)) for key, item in value.items())


def _text(value: Any, minimum: int, maximum: int, name: str, errors: list[str]) -> str:
    text = str(value or "").strip()
    if len(text) < minimum or len(text) > maximum:
        errors.append(f"{name} must contain {minimum}-{maximum} characters")
    return text


def _safe_resource_id(value: Any) -> str | None:
    if value is None or value == "":
        return None
    text = str(value)
    return text if re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", text) else None


def _safe_version(value: Any) -> str:
    text = str(value or "1")
    if not re.fullmatch(r"[A-Za-z0-9._:+-]{1,128}", text):
        raise GenerationValidationError(["resource_version is invalid"])
    return text


def _generated_id(item_type: str) -> str:
    prefix = {
        "REQUIREMENT": "REQ",
        "TEST_SCENARIO": "SCN",
        "TEST_CASE": "TC",
        "TEST_DATA": "TD",
        "LOGICAL_STEP": "LS",
        "TEST_SCRIPT": "TS",
    }.get(item_type, "ITEM")
    return f"{prefix}-{uuid.uuid4().hex[:20]}"


def _normalize_json(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))
