from __future__ import annotations

import json
import os
import pathlib
import re
import shutil
import threading
import time
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from .contracts import (
    ExecutionRequest,
    ExecutionResult,
    FailureClassification,
    Platform,
    RuntimeHealth,
    utc_now,
)
from .evidence import collect_artifacts, write_runtime_proof, write_text_artifact
from .package import ACTION_KEYWORDS, ASSERTION_KEYWORDS, ValidatedPackage, safe_child
from .process_runner import ProcessExecutionError, TrackedProcessRunner, resolve_executable, validate_environment_name


class BaseRobotExecutor(ABC):
    platform: Platform

    def __init__(self, runner: TrackedProcessRunner | None = None) -> None:
        self._runner = runner or TrackedProcessRunner()

    @abstractmethod
    def check(self, runtime: Mapping[str, Any]) -> RuntimeHealth:
        raise NotImplementedError

    def execute(
        self,
        *,
        request: ExecutionRequest,
        package: ValidatedPackage,
        workspace_root: pathlib.Path,
        cancellation: threading.Event,
    ) -> ExecutionResult:
        started_at = utc_now()
        started_clock = time.monotonic()
        workspace = package.materialize(workspace_root / "workspaces", request.execution_id)
        output_directory = safe_child(workspace, "artifacts")
        output_directory.mkdir(parents=True, exist_ok=True)
        suite_path = safe_child(workspace, package.suite_path)
        health = self.check(request.runtime)
        if not health.ready:
            return self._blocked_result(request, started_at, started_clock, health)

        environment = self._execution_environment(request, health)
        dryrun_directory = safe_child(workspace, "dryrun")
        dryrun_directory.mkdir(parents=True, exist_ok=True)
        robot = self._robot_executable()

        try:
            dryrun = self._runner.run(
                f"{request.execution_id}-dryrun",
                robot,
                [
                    "--dryrun",
                    "--outputdir",
                    str(dryrun_directory),
                    "--output",
                    "output.xml",
                    "--log",
                    "NONE",
                    "--report",
                    "NONE",
                    *self._robot_variables(request),
                    str(suite_path),
                ],
                working_directory=workspace,
                environment=environment,
                timeout_seconds=min(request.timeout_seconds, 120),
                cancellation=cancellation,
            )
            write_text_artifact(dryrun_directory, "stdout.log", dryrun.stdout)
            write_text_artifact(dryrun_directory, "stderr.log", dryrun.stderr)
            if dryrun.exit_code != 0:
                classification = classify_robot_failure(dryrun.stdout, dryrun.stderr, dryrun.exit_code, dryrun=True)
                return self._failed_before_execution(
                    request,
                    started_at,
                    started_clock,
                    classification,
                    first_useful_message(dryrun.stderr, dryrun.stdout, "Robot dry run failed"),
                    health,
                    [dryrun_directory],
                )

            platform_context = self.before_execution(request, workspace, output_directory, cancellation)
            result = self._runner.run(
                request.execution_id,
                robot,
                [
                    "--outputdir",
                    str(output_directory),
                    "--output",
                    "output.xml",
                    "--log",
                    "log.html",
                    "--report",
                    "report.html",
                    *self._robot_variables(request),
                    str(suite_path),
                ],
                working_directory=workspace,
                environment=environment,
                timeout_seconds=request.timeout_seconds,
                cancellation=cancellation,
            )
            write_text_artifact(output_directory, "stdout.log", result.stdout)
            write_text_artifact(output_directory, "stderr.log", result.stderr)
            self.after_execution(request, workspace, output_directory, platform_context, cancellation)

            proof = parse_robot_output(output_directory / "output.xml")
            session_created = self.session_created(health, proof, platform_context)
            runtime_proof = {
                "schema_version": "1.0",
                "execution_id": request.execution_id,
                "correlation_id": request.correlation_id,
                "platform": request.platform.value,
                "real_execution": True,
                "simulated": False,
                "target_connected": health.target_connected,
                "desktop_execution": request.platform is Platform.WINDOWS,
                "interactive_desktop": request.platform is Platform.WINDOWS and health.ready,
                "application_controlled": request.platform is Platform.WINDOWS and session_created,
                "session_created": session_created,
                "runtime_health": health.to_dict(),
                "robot_exit_code": result.exit_code,
                "meaningful_actions": proof["meaningful_actions"],
                "meaningful_actions_executed": int(proof["meaningful_actions"]) > 0,
                "meaningful_assertions": proof["meaningful_assertions"],
                "meaningful_assertions_executed": int(proof["meaningful_assertions"]) > 0,
                "checked_at": health.checked_at,
                "started_at": started_at,
                "finished_at": utc_now(),
                "metadata": self.runtime_proof_metadata(platform_context),
            }
            write_runtime_proof(output_directory, runtime_proof)
            finished_at = runtime_proof["finished_at"]
            artifacts = collect_artifacts(
                [output_directory],
                request.evidence_policy,
                started_at=started_at,
                finished_at=str(finished_at),
                additional_metadata={
                    "platform": request.platform.value,
                    "execution_id": request.execution_id,
                },
            )

            passed = (
                result.exit_code == 0
                and proof["suite_passed"]
                and int(proof["meaningful_actions"]) > 0
                and int(proof["meaningful_assertions"]) > 0
                and health.target_connected
                and self.platform_pass_requirements(health, session_created, artifacts)
            )
            classification = None if passed else classify_robot_failure(
                proof.get("failure_message") or "",
                "\n".join((result.stdout, result.stderr)),
                result.exit_code,
                dryrun=False,
            )
            failure_message = None if passed else (
                proof.get("failure_message")
                or first_useful_message(result.stderr, result.stdout, "Robot execution did not satisfy the proof contract")
            )
            return ExecutionResult(
                execution_id=request.execution_id,
                correlation_id=request.correlation_id,
                platform=request.platform,
                status="PASSED" if passed else "FAILED",
                real_execution=True,
                simulated=False,
                target_connected=health.target_connected,
                session_created=session_created,
                exit_code=result.exit_code,
                meaningful_actions=int(proof["meaningful_actions"]),
                meaningful_assertions=int(proof["meaningful_assertions"]),
                started_at=started_at,
                finished_at=str(finished_at),
                duration_ms=max(0, int((time.monotonic() - started_clock) * 1000)),
                artifacts=artifacts,
                desktop_execution=request.platform is Platform.WINDOWS,
                interactive_desktop=request.platform is Platform.WINDOWS and health.ready,
                application_controlled=request.platform is Platform.WINDOWS and session_created,
                runner_version=self._robot_version(),
                application_version=self.application_version(platform_context),
                device_version=self.device_version(platform_context),
                failure_classification=classification,
                failure_message=failure_message,
                expected_result=proof.get("expected_result"),
                actual_result=proof.get("actual_result"),
                metadata={
                    "package_bytes": package.package_bytes,
                    "suite_path": package.suite_path,
                    "runtime_health_checked_at": health.checked_at,
                    "platform_context": self.public_platform_context(platform_context),
                },
            )
        except ProcessExecutionError as exc:
            finished_at = utc_now()
            write_runtime_proof(
                output_directory,
                {
                    "schema_version": "1.0",
                    "execution_id": request.execution_id,
                    "platform": request.platform.value,
                    "real_execution": True,
                    "simulated": False,
                    "target_connected": health.target_connected,
                    "session_created": False,
                    "error_code": exc.code,
                    "message": str(exc),
                    "started_at": started_at,
                    "finished_at": finished_at,
                },
            )
            artifacts = collect_artifacts(
                [output_directory],
                request.evidence_policy,
                started_at=started_at,
                finished_at=finished_at,
            )
            classification = {
                "EXECUTION_TIMEOUT": FailureClassification.EXECUTION_TIMEOUT.value,
                "EXECUTION_CANCELLED": FailureClassification.EXECUTION_CANCELLED.value,
                "EXECUTABLE_NOT_FOUND": FailureClassification.ENVIRONMENT_DEFECT.value,
            }.get(exc.code, FailureClassification.SCRIPT_DEFECT.value)
            status = "CANCELLED" if exc.code == "EXECUTION_CANCELLED" else "BLOCKED" if classification == FailureClassification.ENVIRONMENT_DEFECT.value else "FAILED"
            return ExecutionResult(
                execution_id=request.execution_id,
                correlation_id=request.correlation_id,
                platform=request.platform,
                status=status,
                real_execution=True,
                simulated=False,
                target_connected=health.target_connected,
                session_created=False,
                exit_code=None,
                meaningful_actions=0,
                meaningful_assertions=0,
                started_at=started_at,
                finished_at=finished_at,
                duration_ms=max(0, int((time.monotonic() - started_clock) * 1000)),
                artifacts=artifacts,
                failure_classification=classification,
                failure_message=str(exc),
            )

    def cancel(self, execution_id: str) -> None:
        self._runner.cancel(execution_id)
        self._runner.cancel(f"{execution_id}-dryrun")
        self.cancel_platform_processes(execution_id)

    def before_execution(
        self,
        request: ExecutionRequest,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        cancellation: threading.Event,
    ) -> Mapping[str, Any]:
        return {}

    def after_execution(
        self,
        request: ExecutionRequest,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        context: Mapping[str, Any],
        cancellation: threading.Event,
    ) -> None:
        return None

    def cancel_platform_processes(self, execution_id: str) -> None:
        return None

    def session_created(
        self,
        health: RuntimeHealth,
        proof: Mapping[str, Any],
        context: Mapping[str, Any],
    ) -> bool:
        return health.session_created or bool(proof.get("automation_session_created"))

    def platform_pass_requirements(
        self,
        health: RuntimeHealth,
        session_created: bool,
        artifacts: Sequence[Any],
    ) -> bool:
        if self.platform in {Platform.WINDOWS, Platform.ANDROID}:
            return session_created
        return True

    def runtime_proof_metadata(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return self.public_platform_context(context)

    def public_platform_context(self, context: Mapping[str, Any]) -> Mapping[str, Any]:
        return {
            key: value
            for key, value in context.items()
            if not re.search(r"password|secret|token|authorization|key", str(key), re.I)
        }

    def application_version(self, context: Mapping[str, Any]) -> str | None:
        value = context.get("application_version")
        return str(value) if value else None

    def device_version(self, context: Mapping[str, Any]) -> str | None:
        value = context.get("device_version")
        return str(value) if value else None

    def _robot_executable(self) -> str:
        return os.environ.get("CYFAST_ROBOT_EXECUTABLE", "robot.exe" if os.name == "nt" else "robot")

    def _robot_version(self) -> str | None:
        try:
            import robot  # type: ignore

            return str(getattr(robot, "__version__", None) or "unknown")
        except Exception:
            return None

    def _execution_environment(self, request: ExecutionRequest, health: RuntimeHealth) -> dict[str, str]:
        output = {
            "CYFAST_EXECUTION_ID": request.execution_id,
            "CYFAST_CORRELATION_ID": request.correlation_id,
            "CYFAST_PLATFORM": request.platform.value,
        }
        references = request.runtime.get("environment_references")
        if isinstance(references, Mapping):
            for target_name, local_name in references.items():
                validate_environment_name(str(target_name))
                validate_environment_name(str(local_name))
                value = os.environ.get(str(local_name))
                if value is None:
                    raise ProcessExecutionError(
                        "ENVIRONMENT_REFERENCE_UNAVAILABLE",
                        f"required local environment reference is unavailable: {local_name}",
                    )
                output[str(target_name)] = value
        return output

    def _robot_variables(self, request: ExecutionRequest) -> list[str]:
        values = request.runtime.get("variables")
        if not isinstance(values, Mapping):
            return []
        arguments: list[str] = []
        for name, value in sorted(values.items(), key=lambda item: str(item[0])):
            text_name = str(name)
            text_value = str(value)
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", text_name):
                raise ProcessExecutionError("ROBOT_VARIABLE_INVALID", f"Robot variable name is invalid: {text_name}")
            if re.search(r"password|secret|token|authorization|api[_-]?key", text_name, re.I):
                raise ProcessExecutionError("ROBOT_SECRET_VARIABLE_REJECTED", "secret Robot variables must use environment references")
            if len(text_value) > 4096 or "\x00" in text_value or "\r" in text_value or "\n" in text_value:
                raise ProcessExecutionError("ROBOT_VARIABLE_INVALID", f"Robot variable value is invalid: {text_name}")
            arguments.extend(["--variable", f"{text_name}:{text_value}"])
        return arguments

    def _blocked_result(
        self,
        request: ExecutionRequest,
        started_at: str,
        started_clock: float,
        health: RuntimeHealth,
    ) -> ExecutionResult:
        return ExecutionResult(
            execution_id=request.execution_id,
            correlation_id=request.correlation_id,
            platform=request.platform,
            status="BLOCKED",
            real_execution=True,
            simulated=False,
            target_connected=False,
            session_created=False,
            exit_code=None,
            meaningful_actions=0,
            meaningful_assertions=0,
            started_at=started_at,
            finished_at=utc_now(),
            duration_ms=max(0, int((time.monotonic() - started_clock) * 1000)),
            artifacts=(),
            failure_classification=health.error_code or FailureClassification.ENVIRONMENT_DEFECT.value,
            failure_message=health.message or "Target runtime is not ready",
            metadata={"runtime_health": health.to_dict()},
        )

    def _failed_before_execution(
        self,
        request: ExecutionRequest,
        started_at: str,
        started_clock: float,
        classification: str,
        message: str,
        health: RuntimeHealth,
        evidence_directories: Sequence[pathlib.Path],
    ) -> ExecutionResult:
        finished_at = utc_now()
        artifacts = collect_artifacts(
            evidence_directories,
            request.evidence_policy,
            started_at=started_at,
            finished_at=finished_at,
        )
        return ExecutionResult(
            execution_id=request.execution_id,
            correlation_id=request.correlation_id,
            platform=request.platform,
            status="FAILED",
            real_execution=False,
            simulated=False,
            target_connected=health.target_connected,
            session_created=False,
            exit_code=1,
            meaningful_actions=0,
            meaningful_assertions=0,
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=max(0, int((time.monotonic() - started_clock) * 1000)),
            artifacts=artifacts,
            failure_classification=classification,
            failure_message=message,
        )


def parse_robot_output(path: pathlib.Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "suite_passed": False,
            "meaningful_actions": 0,
            "meaningful_assertions": 0,
            "automation_session_created": False,
            "failure_message": "Robot output.xml is missing",
        }
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as exc:
        return {
            "suite_passed": False,
            "meaningful_actions": 0,
            "meaningful_assertions": 0,
            "automation_session_created": False,
            "failure_message": f"Robot output.xml could not be parsed: {exc}",
        }

    passed_keywords: list[str] = []
    first_failure: str | None = None
    for keyword in root.iter("kw"):
        name = str(keyword.attrib.get("name") or "").strip().lower()
        statuses = list(keyword.findall("status"))
        status = statuses[-1].attrib.get("status") if statuses else None
        if str(status).upper() == "PASS":
            passed_keywords.append(name)
        elif first_failure is None:
            for status_node in statuses:
                if str(status_node.attrib.get("status")).upper() == "FAIL" and (status_node.text or "").strip():
                    first_failure = (status_node.text or "").strip()[:16_384]
                    break

    actions = sum(1 for name in passed_keywords if any(keyword in name for keyword in ACTION_KEYWORDS))
    assertions = sum(1 for name in passed_keywords if any(keyword in name for keyword in ASSERTION_KEYWORDS))
    session_created = any(
        phrase in name
        for name in passed_keywords
        for phrase in ("open application", "create webdriver", "start application", "attach application", "open browser")
    )
    suite_statuses = [node.attrib.get("status") for node in root.iter("status")]
    suite_passed = bool(suite_statuses) and str(suite_statuses[-1]).upper() == "PASS"
    return {
        "suite_passed": suite_passed,
        "meaningful_actions": actions,
        "meaningful_assertions": assertions,
        "automation_session_created": session_created,
        "failure_message": first_failure,
    }


def classify_robot_failure(primary: str, secondary: str, exit_code: int, *, dryrun: bool) -> str:
    text = f"{primary}\n{secondary}".lower()
    if re.search(r"(?:resource|library|keyword).*(?:not found|does not exist|failed to import|no keyword)", text):
        return FailureClassification.KEYWORD_IMPORT_DEFECT.value
    if dryrun:
        return FailureClassification.SCRIPT_DEFECT.value
    if re.search(r"(?:element|locator).*(?:not found|did not match|unable to locate|no such element)", text):
        return FailureClassification.LOCATOR_FAILURE.value
    if re.search(r"(?:assert|should|expected).*(?:failed|not equal|not visible|does not contain|actual)", text):
        return FailureClassification.ASSERTION_FAILURE.value
    if re.search(r"timeout|timed out|wait until", text):
        return FailureClassification.TIMING_FAILURE.value
    if exit_code == 0:
        return FailureClassification.EVIDENCE_FAILURE.value
    return FailureClassification.UNKNOWN_FAILURE.value


def first_useful_message(primary: str, secondary: str, fallback: str) -> str:
    value = primary.strip() or secondary.strip() or fallback
    return value[:16_384]
