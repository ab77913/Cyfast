from __future__ import annotations

import dataclasses
import enum
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence


class Platform(str, enum.Enum):
    WINDOWS = "WINDOWS"
    LINUX = "LINUX"
    ANDROID = "ANDROID"
    EMBEDDED = "EMBEDDED"

    @classmethod
    def parse(cls, value: str) -> "Platform":
        try:
            return cls(str(value).strip().upper())
        except ValueError as exc:
            raise ValueError(f"unsupported platform: {value!r}") from exc


class JobState(str, enum.Enum):
    CREATED = "CREATED"
    VALIDATING = "VALIDATING"
    READY = "READY"
    RUNNING = "RUNNING"
    COLLECTING_EVIDENCE = "COLLECTING_EVIDENCE"
    PASSED = "PASSED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"

    @property
    def terminal(self) -> bool:
        return self in {self.PASSED, self.FAILED, self.BLOCKED, self.CANCELLED}


class FailureClassification(str, enum.Enum):
    LOCATOR_FAILURE = "LOCATOR_FAILURE"
    TIMING_FAILURE = "TIMING_FAILURE"
    ASSERTION_FAILURE = "ASSERTION_FAILURE"
    SCRIPT_DEFECT = "SCRIPT_DEFECT"
    KEYWORD_IMPORT_DEFECT = "KEYWORD_IMPORT_DEFECT"
    TEST_DATA_DEFECT = "TEST_DATA_DEFECT"
    PRODUCT_DEFECT = "PRODUCT_DEFECT"
    ENVIRONMENT_DEFECT = "ENVIRONMENT_DEFECT"
    TARGET_UNAVAILABLE = "TARGET_UNAVAILABLE"
    PERMISSION_FAILURE = "PERMISSION_FAILURE"
    EXECUTION_TIMEOUT = "EXECUTION_TIMEOUT"
    EXECUTION_CANCELLED = "EXECUTION_CANCELLED"
    EVIDENCE_FAILURE = "EVIDENCE_FAILURE"
    UNKNOWN_FAILURE = "UNKNOWN_FAILURE"


@dataclasses.dataclass(frozen=True, slots=True)
class PackageFile:
    path: str
    content_base64: str
    sha256: str | None = None
    size: int | None = None

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "PackageFile":
        return cls(
            path=str(value.get("path") or ""),
            content_base64=str(value.get("content_base64") or value.get("contentBase64") or ""),
            sha256=_optional_text(value.get("sha256")),
            size=_optional_int(value.get("size")),
        )


@dataclasses.dataclass(frozen=True, slots=True)
class ExecutionPackage:
    suite_path: str
    files: tuple[PackageFile, ...]
    package_sha256: str | None = None
    manifest: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "ExecutionPackage":
        files = value.get("files")
        if not isinstance(files, Sequence) or isinstance(files, (str, bytes, bytearray)):
            raise ValueError("package.files must be an array")
        return cls(
            suite_path=str(value.get("suite_path") or value.get("suitePath") or ""),
            files=tuple(PackageFile.from_mapping(item) for item in files if isinstance(item, Mapping)),
            package_sha256=_optional_text(value.get("package_sha256") or value.get("packageSha256")),
            manifest=value.get("manifest") if isinstance(value.get("manifest"), Mapping) else {},
        )


@dataclasses.dataclass(frozen=True, slots=True)
class EvidencePolicy:
    screen_recording: bool = True
    screenshots: bool = True
    device_logs: bool = True
    protocol_trace: bool = True
    maximum_artifact_bytes: int = 20 * 1024 * 1024
    retention_classification: str = "STANDARD"

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "EvidencePolicy":
        source = value or {}
        maximum = int(source.get("maximum_artifact_bytes") or 20 * 1024 * 1024)
        return cls(
            screen_recording=bool(source.get("screen_recording", True)),
            screenshots=bool(source.get("screenshots", True)),
            device_logs=bool(source.get("device_logs", True)),
            protocol_trace=bool(source.get("protocol_trace", True)),
            maximum_artifact_bytes=max(1024, min(maximum, 100 * 1024 * 1024)),
            retention_classification=str(source.get("retention_classification") or "STANDARD").upper(),
        )


@dataclasses.dataclass(frozen=True, slots=True)
class ExecutionRequest:
    execution_id: str
    correlation_id: str
    platform: Platform
    package: ExecutionPackage
    runtime: Mapping[str, Any]
    evidence_policy: EvidencePolicy
    timeout_seconds: int
    organization_id: int
    project_id: int

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any], expected_platform: Platform) -> "ExecutionRequest":
        execution_id = _safe_id(value.get("execution_id"), "execution_id")
        correlation_id = _safe_id(value.get("correlation_id") or execution_id, "correlation_id")
        platform = Platform.parse(str(value.get("platform") or expected_platform.value))
        if platform is not expected_platform:
            raise ValueError(f"platform mismatch: expected {expected_platform.value}, received {platform.value}")
        package_value = value.get("package")
        if not isinstance(package_value, Mapping):
            raise ValueError("package is required")
        runtime = value.get("runtime") if isinstance(value.get("runtime"), Mapping) else {}
        manifest = package_value.get("manifest") if isinstance(package_value.get("manifest"), Mapping) else {}
        organization_id = _positive_int(
            value.get("organization_id") or manifest.get("organization_id"),
            "organization_id",
        )
        project_id = _positive_int(value.get("project_id") or manifest.get("project_id"), "project_id")
        timeout_seconds = max(30, min(int(value.get("timeout_seconds") or 900), 86_400))
        return cls(
            execution_id=execution_id,
            correlation_id=correlation_id,
            platform=platform,
            package=ExecutionPackage.from_mapping(package_value),
            runtime=runtime,
            evidence_policy=EvidencePolicy.from_mapping(
                value.get("evidence_policy") if isinstance(value.get("evidence_policy"), Mapping) else None
            ),
            timeout_seconds=timeout_seconds,
            organization_id=organization_id,
            project_id=project_id,
        )


@dataclasses.dataclass(frozen=True, slots=True)
class ComponentHealth:
    ready: bool
    name: str
    version: str | None = None
    endpoint: str | None = None
    process_id: int | None = None
    message: str | None = None
    error_code: str | None = None
    metadata: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none(dataclasses.asdict(self))


@dataclasses.dataclass(frozen=True, slots=True)
class RuntimeHealth:
    platform: Platform
    ready: bool
    status: str
    real_execution: bool
    simulated: bool
    target_connected: bool
    session_created: bool
    components: tuple[ComponentHealth, ...]
    capabilities: tuple[str, ...]
    checked_at: str
    error_code: str | None = None
    message: str | None = None
    metadata: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def blocked(
        cls,
        platform: Platform,
        code: str,
        message: str,
        *,
        components: Sequence[ComponentHealth] = (),
        capabilities: Sequence[str] = (),
        metadata: Mapping[str, Any] | None = None,
    ) -> "RuntimeHealth":
        return cls(
            platform=platform,
            ready=False,
            status="DEGRADED",
            real_execution=True,
            simulated=False,
            target_connected=False,
            session_created=False,
            components=tuple(components),
            capabilities=tuple(capabilities),
            checked_at=utc_now(),
            error_code=code,
            message=message,
            metadata=metadata or {},
        )

    def to_dict(self) -> dict[str, Any]:
        value = dataclasses.asdict(self)
        value["platform"] = self.platform.value
        value["components"] = [component.to_dict() for component in self.components]
        return _drop_none(value)


@dataclasses.dataclass(frozen=True, slots=True)
class Artifact:
    type: str
    filename: str
    content_type: str
    content_base64: str
    size: int
    sha256: str
    captured_at: str
    retention_classification: str = "STANDARD"
    redacted: bool = True
    started_at: str | None = None
    finished_at: str | None = None
    format: str | None = None
    metadata: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return _drop_none(dataclasses.asdict(self))


@dataclasses.dataclass(frozen=True, slots=True)
class ExecutionResult:
    execution_id: str
    correlation_id: str
    platform: Platform
    status: str
    real_execution: bool
    simulated: bool
    target_connected: bool
    session_created: bool
    exit_code: int | None
    meaningful_actions: int
    meaningful_assertions: int
    started_at: str
    finished_at: str
    duration_ms: int
    artifacts: tuple[Artifact, ...]
    runner_version: str | None = None
    application_version: str | None = None
    device_version: str | None = None
    failure_classification: str | None = None
    failure_message: str | None = None
    expected_result: str | None = None
    actual_result: str | None = None
    metadata: Mapping[str, Any] = dataclasses.field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        value = dataclasses.asdict(self)
        value["platform"] = self.platform.value
        value["artifacts"] = [artifact.to_dict() for artifact in self.artifacts]
        return _drop_none(value)


@dataclasses.dataclass(slots=True)
class JobSnapshot:
    execution_id: str
    platform: Platform
    state: JobState
    created_at: str
    updated_at: str
    started_at: str | None = None
    finished_at: str | None = None
    error_code: str | None = None
    message: str | None = None
    result: ExecutionResult | None = None

    def to_dict(self, include_result: bool = True) -> dict[str, Any]:
        value: dict[str, Any] = {
            "execution_id": self.execution_id,
            "platform": self.platform.value,
            "status": self.state.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "error_code": self.error_code,
            "message": self.message,
        }
        if include_result and self.result is not None:
            value["result"] = self.result.to_dict()
        return _drop_none(value)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def redact(value: Any) -> Any:
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact(item) for item in value)
    if not isinstance(value, Mapping):
        return value
    output: dict[str, Any] = {}
    for key, item in value.items():
        if re.search(r"password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key", str(key), re.I):
            output[str(key)] = "[REDACTED]"
        else:
            output[str(key)] = redact(item)
    return output


def _safe_id(value: Any, name: str) -> str:
    text = str(value or "")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", text):
        raise ValueError(f"{name} is invalid")
    return text


def _positive_int(value: Any, name: str) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a positive integer") from exc
    if number <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return number


def _optional_text(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


def _drop_none(value: Mapping[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}
