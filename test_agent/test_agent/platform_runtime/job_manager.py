from __future__ import annotations

import dataclasses
import json
import os
import pathlib
import threading
import traceback
import urllib.error
import urllib.request
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Mapping

from .contracts import (
    ExecutionRequest,
    ExecutionResult,
    JobSnapshot,
    JobState,
    Platform,
    redact,
    utc_now,
)
from .package import PackageValidationError, create_workspace_root, validate_package


class JobManager:
    """Runs bounded jobs and persists metadata without persisting package secrets."""

    def __init__(
        self,
        registry: Any,
        *,
        workspace_root: pathlib.Path | None = None,
        maximum_workers: int | None = None,
        callback_url: str | None = None,
        callback_token: str | None = None,
        callback_timeout_seconds: int = 30,
    ) -> None:
        self._registry = registry
        self._workspace_root = workspace_root or create_workspace_root()
        self._workspace_root.mkdir(parents=True, exist_ok=True)
        workers = maximum_workers or int(os.environ.get("CYFAST_AGENT_MAX_PARALLEL_JOBS", "2"))
        self._executor = ThreadPoolExecutor(max_workers=max(1, min(workers, 16)), thread_name_prefix="cyfast-job")
        self._jobs: dict[str, JobSnapshot] = {}
        self._futures: dict[str, Future[None]] = {}
        self._cancellations: dict[str, threading.Event] = {}
        self._lock = threading.RLock()
        self._callback_url = callback_url or os.environ.get("CYFAST_CONTROL_PLANE_CALLBACK_URL")
        self._callback_token = callback_token or os.environ.get("CYFAST_INTERNAL_API_TOKEN")
        self._callback_timeout_seconds = max(5, min(callback_timeout_seconds, 120))
        self._load_metadata()

    @property
    def workspace_root(self) -> pathlib.Path:
        return self._workspace_root

    def create(self, request: ExecutionRequest) -> JobSnapshot:
        with self._lock:
            existing = self._jobs.get(request.execution_id)
            if existing is not None:
                return dataclasses.replace(existing)
            now = utc_now()
            snapshot = JobSnapshot(
                execution_id=request.execution_id,
                platform=request.platform,
                state=JobState.CREATED,
                created_at=now,
                updated_at=now,
            )
            self._jobs[request.execution_id] = snapshot
            cancellation = threading.Event()
            self._cancellations[request.execution_id] = cancellation
            self._persist(snapshot)
            future = self._executor.submit(self._run, request, cancellation)
            self._futures[request.execution_id] = future
            return dataclasses.replace(snapshot)

    def get(self, execution_id: str) -> JobSnapshot | None:
        with self._lock:
            snapshot = self._jobs.get(execution_id)
            return dataclasses.replace(snapshot) if snapshot else None

    def cancel(self, execution_id: str) -> JobSnapshot | None:
        with self._lock:
            snapshot = self._jobs.get(execution_id)
            if snapshot is None:
                return None
            if snapshot.state.terminal:
                return dataclasses.replace(snapshot)
            cancellation = self._cancellations.setdefault(execution_id, threading.Event())
            cancellation.set()
            executor = self._registry.get(snapshot.platform)
            try:
                executor.cancel(execution_id)
            except Exception:
                pass
            snapshot.state = JobState.CANCELLED
            snapshot.updated_at = utc_now()
            snapshot.finished_at = snapshot.updated_at
            snapshot.error_code = "EXECUTION_CANCELLED"
            snapshot.message = "Execution cancellation requested"
            self._persist(snapshot)
            return dataclasses.replace(snapshot)

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _run(self, request: ExecutionRequest, cancellation: threading.Event) -> None:
        started = utc_now()
        try:
            self._update(
                request.execution_id,
                state=JobState.VALIDATING,
                started_at=started,
                message="Validating execution package",
            )
            validated = validate_package(request.package)
            if cancellation.is_set():
                raise CancelledError()
            executor = self._registry.get(request.platform)
            health = executor.check(request.runtime)
            if not health.ready:
                self._finish_blocked(
                    request,
                    health.error_code or "TARGET_NOT_READY",
                    health.message or "Execution target is not ready",
                    metadata={"runtime_health": health.to_dict()},
                )
                return
            self._update(request.execution_id, state=JobState.READY, message="Target is ready")
            if cancellation.is_set():
                raise CancelledError()
            self._update(request.execution_id, state=JobState.RUNNING, message="Execution started")
            result = executor.execute(
                request=request,
                package=validated,
                workspace_root=self._workspace_root,
                cancellation=cancellation,
            )
            if cancellation.is_set() and result.status != "CANCELLED":
                raise CancelledError()
            self._update(request.execution_id, state=JobState.COLLECTING_EVIDENCE, message="Collecting execution evidence")
            terminal_state = {
                "PASSED": JobState.PASSED,
                "BLOCKED": JobState.BLOCKED,
                "CANCELLED": JobState.CANCELLED,
            }.get(str(result.status).upper(), JobState.FAILED)
            self._update(
                request.execution_id,
                state=terminal_state,
                finished_at=result.finished_at,
                result=result,
                error_code=result.failure_classification,
                message=result.failure_message,
            )
            self._callback(request, result)
        except CancelledError:
            result = _cancelled_result(request, started)
            self._update(
                request.execution_id,
                state=JobState.CANCELLED,
                finished_at=result.finished_at,
                result=result,
                error_code="EXECUTION_CANCELLED",
                message=result.failure_message,
            )
            self._callback(request, result)
        except PackageValidationError as exc:
            result = _failed_result(request, started, exc.code, str(exc), blocked=False)
            self._update(
                request.execution_id,
                state=JobState.FAILED,
                finished_at=result.finished_at,
                result=result,
                error_code=exc.code,
                message=str(exc),
            )
            self._callback(request, result)
        except Exception as exc:  # Defensive boundary around platform plugins.
            message = f"{type(exc).__name__}: {exc}"
            result = _failed_result(request, started, "AGENT_EXECUTION_FAILED", message, blocked=False)
            self._update(
                request.execution_id,
                state=JobState.FAILED,
                finished_at=result.finished_at,
                result=result,
                error_code="AGENT_EXECUTION_FAILED",
                message=message,
            )
            self._append_diagnostic(request.execution_id, traceback.format_exc())
            self._callback(request, result)

    def _finish_blocked(
        self,
        request: ExecutionRequest,
        code: str,
        message: str,
        *,
        metadata: Mapping[str, Any],
    ) -> None:
        snapshot = self.get(request.execution_id)
        started = snapshot.started_at if snapshot and snapshot.started_at else utc_now()
        result = _failed_result(request, started, code, message, blocked=True, metadata=metadata)
        self._update(
            request.execution_id,
            state=JobState.BLOCKED,
            finished_at=result.finished_at,
            result=result,
            error_code=code,
            message=message,
        )
        self._callback(request, result)

    def _update(self, execution_id: str, **values: Any) -> None:
        with self._lock:
            snapshot = self._jobs[execution_id]
            for key, value in values.items():
                if value is not None:
                    setattr(snapshot, key, value)
            snapshot.updated_at = utc_now()
            self._persist(snapshot)

    def _persist(self, snapshot: JobSnapshot) -> None:
        directory = self._workspace_root / "metadata"
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{snapshot.execution_id}.json"
        temporary = path.with_suffix(".tmp")
        value = snapshot.to_dict(include_result=True)
        temporary.write_text(json.dumps(redact(value), ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        temporary.replace(path)

    def _load_metadata(self) -> None:
        directory = self._workspace_root / "metadata"
        if not directory.exists():
            return
        for path in directory.glob("*.json"):
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
                state = JobState(value["status"])
                if not state.terminal:
                    state = JobState.BLOCKED
                    value["error_code"] = "AGENT_RESTART_INTERRUPTED"
                    value["message"] = "Execution was interrupted by an agent restart"
                    value["finished_at"] = utc_now()
                snapshot = JobSnapshot(
                    execution_id=value["execution_id"],
                    platform=Platform(value["platform"]),
                    state=state,
                    created_at=value["created_at"],
                    updated_at=utc_now(),
                    started_at=value.get("started_at"),
                    finished_at=value.get("finished_at"),
                    error_code=value.get("error_code"),
                    message=value.get("message"),
                    result=None,
                )
                self._jobs[snapshot.execution_id] = snapshot
            except (OSError, ValueError, KeyError, json.JSONDecodeError):
                continue

    def _append_diagnostic(self, execution_id: str, text: str) -> None:
        directory = self._workspace_root / "diagnostics"
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{execution_id}.log"
        safe = text.replace(os.environ.get("CYFAST_AGENT_TOKEN", "__never__"), "[REDACTED]")
        path.write_text(safe[-200_000:], encoding="utf-8")

    def _callback(self, request: ExecutionRequest, result: ExecutionResult) -> None:
        if not self._callback_url or not self._callback_token:
            return
        base = self._callback_url.rstrip("/")
        url = f"{base}/internal/execution_runs/{request.execution_id}/result"
        payload = result.to_dict()
        payload["organization_id"] = request.organization_id
        payload["project_id"] = request.project_id
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        outgoing = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={
                "authorization": f"Bearer {self._callback_token}",
                "content-type": "application/json",
                "x-agent-id": os.environ.get("CYFAST_AGENT_ID", "platform-runtime"),
                "x-organization-id": str(request.organization_id),
                "x-project-id": str(request.project_id),
                "x-correlation-id": request.correlation_id,
            },
        )
        try:
            with urllib.request.urlopen(outgoing, timeout=self._callback_timeout_seconds) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"callback failed with status {response.status}")
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            self._append_diagnostic(request.execution_id, f"callback error: {exc}")


class CancelledError(Exception):
    pass


def _failed_result(
    request: ExecutionRequest,
    started_at: str,
    code: str,
    message: str,
    *,
    blocked: bool,
    metadata: Mapping[str, Any] | None = None,
) -> ExecutionResult:
    finished = utc_now()
    return ExecutionResult(
        execution_id=request.execution_id,
        correlation_id=request.correlation_id,
        platform=request.platform,
        status="BLOCKED" if blocked else "FAILED",
        real_execution=True,
        simulated=False,
        target_connected=False,
        session_created=False,
        exit_code=None,
        meaningful_actions=0,
        meaningful_assertions=0,
        started_at=started_at,
        finished_at=finished,
        duration_ms=_duration_ms(started_at, finished),
        artifacts=(),
        failure_classification=code,
        failure_message=message,
        metadata=metadata or {},
    )


def _cancelled_result(request: ExecutionRequest, started_at: str) -> ExecutionResult:
    return _failed_result(
        request,
        started_at,
        "EXECUTION_CANCELLED",
        "Execution was cancelled",
        blocked=False,
    )


def _duration_ms(started: str, finished: str) -> int:
    def parse(value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)

    return max(0, int((parse(finished) - parse(started)).total_seconds() * 1000))
