from __future__ import annotations

import dataclasses
import os
import pathlib
import shutil
import signal
import subprocess
import threading
import time
from typing import Mapping, Sequence


MAX_CAPTURE_BYTES = 1_000_000


class ProcessExecutionError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclasses.dataclass(frozen=True, slots=True)
class ProcessResult:
    exit_code: int
    stdout: str
    stderr: str
    started_monotonic: float
    finished_monotonic: float

    @property
    def duration_ms(self) -> int:
        return max(0, int((self.finished_monotonic - self.started_monotonic) * 1000))


class TrackedProcessRunner:
    def __init__(self) -> None:
        self._processes: dict[str, subprocess.Popen[bytes]] = {}
        self._lock = threading.RLock()

    def run(
        self,
        job_id: str,
        executable: str,
        arguments: Sequence[str],
        *,
        working_directory: pathlib.Path,
        environment: Mapping[str, str] | None,
        timeout_seconds: int,
        cancellation: threading.Event,
    ) -> ProcessResult:
        resolved = resolve_executable(executable)
        if not working_directory.is_absolute() or not working_directory.exists():
            raise ProcessExecutionError("WORKING_DIRECTORY_INVALID", "working directory must be an existing absolute path")
        safe_arguments = [validate_argument(value) for value in arguments]
        process_environment = os.environ.copy()
        for name, value in (environment or {}).items():
            validate_environment_name(name)
            if len(value) > 16_384 or "\x00" in value:
                raise ProcessExecutionError("ENVIRONMENT_VALUE_INVALID", f"environment value is invalid: {name}")
            process_environment[name] = value

        creation_flags = 0
        start_new_session = os.name != "nt"
        if os.name == "nt":
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
        started = time.monotonic()
        process = subprocess.Popen(
            [resolved, *safe_arguments],
            cwd=str(working_directory),
            env=process_environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            creationflags=creation_flags,
            start_new_session=start_new_session,
        )
        with self._lock:
            if job_id in self._processes:
                terminate_process(process)
                raise ProcessExecutionError("JOB_PROCESS_ALREADY_RUNNING", f"a process is already tracked for {job_id}")
            self._processes[job_id] = process

        try:
            deadline = started + max(1, timeout_seconds)
            while process.poll() is None:
                if cancellation.wait(0.2):
                    terminate_process(process)
                    raise ProcessExecutionError("EXECUTION_CANCELLED", "execution was cancelled")
                if time.monotonic() >= deadline:
                    terminate_process(process)
                    raise ProcessExecutionError("EXECUTION_TIMEOUT", "execution exceeded the configured timeout")
            stdout_bytes, stderr_bytes = process.communicate(timeout=10)
            finished = time.monotonic()
            return ProcessResult(
                exit_code=int(process.returncode or 0),
                stdout=bounded_decode(stdout_bytes),
                stderr=bounded_decode(stderr_bytes),
                started_monotonic=started,
                finished_monotonic=finished,
            )
        finally:
            with self._lock:
                tracked = self._processes.get(job_id)
                if tracked is process:
                    self._processes.pop(job_id, None)
            if process.poll() is None:
                terminate_process(process)

    def cancel(self, job_id: str) -> None:
        with self._lock:
            process = self._processes.get(job_id)
        if process is not None:
            terminate_process(process)


def resolve_executable(value: str) -> str:
    text = str(value or "").strip()
    if not text or "\x00" in text:
        raise ProcessExecutionError("EXECUTABLE_REQUIRED", "configured executable is required")
    candidate = pathlib.Path(text).expanduser()
    if candidate.is_absolute():
        resolved = candidate.resolve()
        if not resolved.is_file():
            raise ProcessExecutionError("EXECUTABLE_NOT_FOUND", f"configured executable was not found: {resolved}")
        return str(resolved)
    if any(separator in text for separator in ("/", "\\")):
        raise ProcessExecutionError("EXECUTABLE_PATH_INVALID", "relative executable paths are not allowed")
    found = shutil.which(text)
    if not found:
        raise ProcessExecutionError("EXECUTABLE_NOT_FOUND", f"configured executable was not found on PATH: {text}")
    return str(pathlib.Path(found).resolve())


def validate_argument(value: str) -> str:
    text = str(value)
    if len(text) > 4096 or "\x00" in text or "\r" in text or "\n" in text:
        raise ProcessExecutionError("PROCESS_ARGUMENT_INVALID", "process argument is invalid")
    return text


def validate_environment_name(value: str) -> None:
    import re

    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", value):
        raise ProcessExecutionError("ENVIRONMENT_NAME_INVALID", f"environment variable name is invalid: {value}")


def terminate_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=False,
                timeout=10,
                check=False,
            )
        else:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            process.kill()
        except OSError:
            pass


def bounded_decode(value: bytes) -> str:
    if len(value) > MAX_CAPTURE_BYTES:
        value = value[-MAX_CAPTURE_BYTES:]
        prefix = b"[CyFAST output truncated]\n"
    else:
        prefix = b""
    return (prefix + value).decode("utf-8", errors="replace")
