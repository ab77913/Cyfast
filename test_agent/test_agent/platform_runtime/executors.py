from __future__ import annotations

import json
import os
import pathlib
import platform as python_platform
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Mapping, Sequence

from .contracts import ComponentHealth, Platform, RuntimeHealth, utc_now
from .process_runner import ProcessExecutionError, TrackedProcessRunner, resolve_executable
from .robot_executor import BaseRobotExecutor


class ExecutorRegistry:
    def __init__(self) -> None:
        self._executors: dict[Platform, BaseRobotExecutor] = {}

    def register(self, executor: BaseRobotExecutor) -> "ExecutorRegistry":
        if executor.platform in self._executors:
            raise ValueError(f"executor already registered: {executor.platform.value}")
        self._executors[executor.platform] = executor
        return self

    def get(self, platform: Platform) -> BaseRobotExecutor:
        try:
            return self._executors[platform]
        except KeyError as exc:
            raise ValueError(f"executor is not registered: {platform.value}") from exc

    def platforms(self) -> tuple[Platform, ...]:
        return tuple(sorted(self._executors, key=lambda item: item.value))


class WindowsExecutor(BaseRobotExecutor):
    platform = Platform.WINDOWS

    def check(self, runtime: Mapping[str, Any]) -> RuntimeHealth:
        components: list[ComponentHealth] = []
        if os.name != "nt":
            return RuntimeHealth.blocked(
                self.platform,
                "WINDOWS_HOST_REQUIRED",
                "Windows execution requires a Windows host",
                capabilities=("windows_robot", "interactive_desktop"),
            )
        robot_health = _executable_health("Robot Framework", self._robot_executable())
        components.append(robot_health)
        if not robot_health.ready:
            return RuntimeHealth.blocked(
                self.platform,
                robot_health.error_code or "ROBOT_EXECUTABLE_NOT_FOUND",
                robot_health.message or "Robot Framework is unavailable",
                components=components,
                capabilities=("windows_robot", "interactive_desktop"),
            )

        proof_path = os.environ.get("CYFAST_WINDOWS_RUNTIME_PROOF")
        if not proof_path:
            return RuntimeHealth.blocked(
                self.platform,
                "WINDOWS_RUNTIME_PROOF_REQUIRED",
                "CYFAST_WINDOWS_RUNTIME_PROOF must reference recent SessionHost/Appium proof",
                components=components,
                capabilities=("windows_robot", "interactive_desktop"),
            )
        try:
            proof_file = pathlib.Path(proof_path).expanduser().resolve()
            if not proof_file.is_file():
                raise FileNotFoundError(str(proof_file))
            proof = json.loads(proof_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            return RuntimeHealth.blocked(
                self.platform,
                "WINDOWS_RUNTIME_PROOF_INVALID",
                f"Windows runtime proof could not be read: {exc}",
                components=components,
                capabilities=("windows_robot", "interactive_desktop"),
            )

        verified_at = _parse_timestamp(
            proof.get("checked_at")
            or proof.get("verified_at")
            or proof.get("driver_session", {}).get("last_verified_at")
        )
        recent = verified_at is not None and (datetime.now(timezone.utc) - verified_at).total_seconds() <= 300
        ready = (
            proof.get("ready") is True
            and proof.get("real_execution") is True
            and proof.get("simulated") is False
            and proof.get("desktop_execution", True) is True
            and recent
        )
        session = proof.get("driver_session") if isinstance(proof.get("driver_session"), Mapping) else {}
        session_created = bool(
            proof.get("session_created") is True
            or session.get("session_created") is True
            or session.get("ready") is True
        )
        application = proof.get("application") if isinstance(proof.get("application"), Mapping) else {}
        application_ready = bool(
            application.get("path_exists", application.get("PathExists", True))
            and application.get("window_found", application.get("WindowFound", True))
        )
        components.extend(
            [
                ComponentHealth(
                    ready=bool(proof.get("appium", {}).get("ready", proof.get("appium_ready", ready)))
                    if isinstance(proof.get("appium"), Mapping)
                    else ready,
                    name="Appium",
                    endpoint=_nested_text(proof, "appium", "endpoint"),
                ),
                ComponentHealth(
                    ready=bool(proof.get("win_app_driver", {}).get("ready", proof.get("winappdriver_ready", ready)))
                    if isinstance(proof.get("win_app_driver"), Mapping)
                    else ready,
                    name="WinAppDriver",
                    endpoint=_nested_text(proof, "win_app_driver", "endpoint"),
                ),
                ComponentHealth(
                    ready=application_ready,
                    name="Windows application",
                    version=_optional_text(application.get("version")),
                    metadata={
                        "process_id": application.get("process_id"),
                        "window_title": application.get("window_title"),
                    },
                ),
            ]
        )
        if not ready or not session_created or not application_ready:
            return RuntimeHealth.blocked(
                self.platform,
                "WINDOWS_RUNTIME_NOT_READY",
                "Windows SessionHost, Appium session, application, and interactive desktop proof are required",
                components=components,
                capabilities=("windows_robot", "windows_uia", "appium_windows", "interactive_desktop"),
                metadata={"proof_file": str(proof_file), "proof_recent": recent},
            )
        return RuntimeHealth(
            platform=self.platform,
            ready=True,
            status="READY",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=True,
            components=tuple(components),
            capabilities=("windows_robot", "windows_uia", "appium_windows", "interactive_desktop"),
            checked_at=utc_now(),
            metadata={
                "proof_file": str(proof_file),
                "application_version": application.get("version"),
                "runtime_proof_verified_at": verified_at.isoformat() if verified_at else None,
            },
        )

    def session_created(self, health: RuntimeHealth, proof: Mapping[str, Any], context: Mapping[str, Any]) -> bool:
        return health.session_created and bool(proof.get("automation_session_created"))

    def before_execution(
        self,
        request: Any,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        cancellation: threading.Event,
    ) -> Mapping[str, Any]:
        health = self.check(request.runtime)
        return {
            "application_version": health.metadata.get("application_version"),
            "runtime_proof_verified_at": health.metadata.get("runtime_proof_verified_at"),
        }


class LinuxExecutor(BaseRobotExecutor):
    platform = Platform.LINUX

    def check(self, runtime: Mapping[str, Any]) -> RuntimeHealth:
        capabilities = ["linux_robot", "pytest", "ssh"]
        if not sys.platform.startswith("linux"):
            return RuntimeHealth.blocked(
                self.platform,
                "LINUX_HOST_REQUIRED",
                "Linux execution requires a Linux host",
                capabilities=capabilities,
            )
        robot = _executable_health("Robot Framework", self._robot_executable())
        components = [robot]
        if not robot.ready:
            return RuntimeHealth.blocked(
                self.platform,
                robot.error_code or "ROBOT_EXECUTABLE_NOT_FOUND",
                robot.message or "Robot Framework is unavailable",
                components=components,
                capabilities=capabilities,
            )
        desktop_required = bool(runtime.get("desktop_required"))
        display = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
        desktop = ComponentHealth(
            ready=not desktop_required or bool(display),
            name="Linux interactive desktop",
            endpoint=display,
            message=None if not desktop_required or display else "DISPLAY or WAYLAND_DISPLAY is unavailable",
            error_code=None if not desktop_required or display else "LINUX_DESKTOP_UNAVAILABLE",
        )
        components.append(desktop)
        if not desktop.ready:
            return RuntimeHealth.blocked(
                self.platform,
                desktop.error_code or "LINUX_DESKTOP_UNAVAILABLE",
                desktop.message or "Linux desktop is unavailable",
                components=components,
                capabilities=capabilities,
            )
        return RuntimeHealth(
            platform=self.platform,
            ready=True,
            status="READY",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=False,
            components=tuple(components),
            capabilities=tuple(capabilities),
            checked_at=utc_now(),
            metadata={
                "kernel": python_platform.release(),
                "distribution": python_platform.platform(),
                "desktop_required": desktop_required,
                "display": display,
            },
        )


class AndroidExecutor(BaseRobotExecutor):
    platform = Platform.ANDROID

    def __init__(self, runner: TrackedProcessRunner | None = None) -> None:
        super().__init__(runner)
        self._recorders: dict[str, subprocess.Popen[bytes]] = {}
        self._recorders_lock = threading.RLock()

    def check(self, runtime: Mapping[str, Any]) -> RuntimeHealth:
        capabilities = ["android_appium", "adb", "screen_recording", "device_log"]
        components: list[ComponentHealth] = []
        robot = _executable_health("Robot Framework", self._robot_executable())
        adb = _executable_health("Android Debug Bridge", os.environ.get("CYFAST_ADB_EXECUTABLE", "adb"))
        components.extend((robot, adb))
        if not robot.ready or not adb.ready:
            failing = next(component for component in components if not component.ready)
            return RuntimeHealth.blocked(
                self.platform,
                failing.error_code or "ANDROID_TOOL_UNAVAILABLE",
                failing.message or "Android execution tool is unavailable",
                components=components,
                capabilities=capabilities,
            )

        try:
            device_id = self._device_id(runtime)
        except ValueError as exc:
            return RuntimeHealth.blocked(
                self.platform,
                "ANDROID_DEVICE_NOT_APPROVED",
                str(exc),
                components=components,
                capabilities=capabilities,
            )
        state = _run_probe([adb.endpoint or "adb", "-s", device_id, "get-state"], timeout=10)
        device_ready = state[0] == 0 and state[1].strip().lower() == "device"
        device_version = None
        if device_ready:
            version = _run_probe(
                [adb.endpoint or "adb", "-s", device_id, "shell", "getprop", "ro.build.version.release"],
                timeout=10,
            )
            device_version = version[1].strip() if version[0] == 0 else None
        components.append(
            ComponentHealth(
                ready=device_ready,
                name="Android device",
                endpoint=device_id,
                version=device_version,
                message=None if device_ready else (state[2].strip() or state[1].strip() or "device is not connected"),
                error_code=None if device_ready else "ANDROID_DEVICE_DISCONNECTED",
            )
        )
        appium_url = _appium_url()
        appium_ready, appium_message = _http_status_ready(f"{appium_url}/status")
        components.append(
            ComponentHealth(
                ready=appium_ready,
                name="Appium",
                endpoint=appium_url,
                message=appium_message if not appium_ready else None,
                error_code=None if appium_ready else "APPIUM_STATUS_FAILED",
            )
        )
        if not device_ready or not appium_ready:
            failing = next(component for component in components if not component.ready)
            return RuntimeHealth.blocked(
                self.platform,
                failing.error_code or "ANDROID_RUNTIME_NOT_READY",
                failing.message or "Android runtime is not ready",
                components=components,
                capabilities=capabilities,
                metadata={"device_id": device_id, "appium_url": appium_url},
            )
        return RuntimeHealth(
            platform=self.platform,
            ready=True,
            status="READY",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=False,
            components=tuple(components),
            capabilities=tuple(capabilities),
            checked_at=utc_now(),
            metadata={
                "device_id": device_id,
                "device_version": device_version,
                "appium_url": appium_url,
            },
        )

    def before_execution(
        self,
        request: Any,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        cancellation: threading.Event,
    ) -> Mapping[str, Any]:
        health = self.check(request.runtime)
        device_id = str(health.metadata["device_id"])
        context: dict[str, Any] = {
            "device_id": device_id,
            "device_version": health.metadata.get("device_version"),
            "appium_url": health.metadata.get("appium_url"),
        }
        if request.evidence_policy.screen_recording:
            remote = f"/sdcard/cyfast-{request.execution_id}.mp4"
            adb = resolve_executable(os.environ.get("CYFAST_ADB_EXECUTABLE", "adb"))
            process = subprocess.Popen(
                [adb, "-s", device_id, "shell", "screenrecord", "--time-limit", str(min(request.timeout_seconds, 180)), remote],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=False,
            )
            with self._recorders_lock:
                self._recorders[request.execution_id] = process
            context["recording_remote_path"] = remote
        return context

    def after_execution(
        self,
        request: Any,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        context: Mapping[str, Any],
        cancellation: threading.Event,
    ) -> None:
        device_id = str(context.get("device_id") or self._device_id(request.runtime))
        adb = resolve_executable(os.environ.get("CYFAST_ADB_EXECUTABLE", "adb"))
        self._stop_recorder(request.execution_id)
        remote = context.get("recording_remote_path")
        if remote:
            local = output_directory / "android-screen-recording.mp4"
            _run_probe([adb, "-s", device_id, "pull", str(remote), str(local)], timeout=60)
            _run_probe([adb, "-s", device_id, "shell", "rm", "-f", str(remote)], timeout=10)
        if request.evidence_policy.device_logs:
            code, stdout, stderr = _run_probe(
                [adb, "-s", device_id, "logcat", "-d", "-t", "5000"],
                timeout=60,
                maximum_output=5_000_000,
            )
            (output_directory / "device-logcat.log").write_text(
                stdout if code == 0 else f"{stdout}\n{stderr}",
                encoding="utf-8",
                errors="replace",
            )

    def cancel_platform_processes(self, execution_id: str) -> None:
        self._stop_recorder(execution_id)

    def session_created(self, health: RuntimeHealth, proof: Mapping[str, Any], context: Mapping[str, Any]) -> bool:
        return bool(proof.get("automation_session_created"))

    def application_version(self, context: Mapping[str, Any]) -> str | None:
        return _optional_text(context.get("application_version"))

    def device_version(self, context: Mapping[str, Any]) -> str | None:
        return _optional_text(context.get("device_version"))

    def _device_id(self, runtime: Mapping[str, Any]) -> str:
        configured_default = os.environ.get("CYFAST_ANDROID_DEVICE_ID")
        requested = str(runtime.get("device_id") or configured_default or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", requested):
            raise ValueError("A valid Android device_id is required")
        allowed = {
            item.strip()
            for item in os.environ.get("CYFAST_ANDROID_ALLOWED_DEVICES", configured_default or "").split(",")
            if item.strip()
        }
        if not allowed or requested not in allowed:
            raise ValueError(f"Android device is not in CYFAST_ANDROID_ALLOWED_DEVICES: {requested}")
        return requested

    def _stop_recorder(self, execution_id: str) -> None:
        with self._recorders_lock:
            process = self._recorders.pop(execution_id, None)
        if process is None or process.poll() is not None:
            return
        try:
            if os.name == "nt":
                process.terminate()
            else:
                process.send_signal(signal.SIGINT)
            process.wait(timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            try:
                process.kill()
            except OSError:
                pass


class EmbeddedExecutor(BaseRobotExecutor):
    platform = Platform.EMBEDDED
    _supported_protocols = {
        "can",
        "lin",
        "uart",
        "spi",
        "i2c",
        "tcp",
        "udp",
        "trdp",
        "bluetooth",
        "wifi",
        "canoe",
        "capl",
    }

    def check(self, runtime: Mapping[str, Any]) -> RuntimeHealth:
        protocol = str(runtime.get("protocol") or "").strip().lower()
        capabilities = tuple(sorted(self._supported_protocols | {"embedded_generic"}))
        if protocol not in self._supported_protocols:
            return RuntimeHealth.blocked(
                self.platform,
                "EMBEDDED_PROTOCOL_UNSUPPORTED",
                f"Unsupported embedded protocol: {protocol or '<empty>'}",
                capabilities=capabilities,
            )
        robot = _executable_health("Robot Framework", self._robot_executable())
        if not robot.ready:
            return RuntimeHealth.blocked(
                self.platform,
                robot.error_code or "ROBOT_EXECUTABLE_NOT_FOUND",
                robot.message or "Robot Framework is unavailable",
                components=(robot,),
                capabilities=capabilities,
            )
        prefix = f"CYFAST_EMBEDDED_{protocol.upper()}"
        configured_interfaces = {
            item.strip()
            for item in os.environ.get(f"{prefix}_INTERFACES", os.environ.get(f"{prefix}_INTERFACE", "")).split(",")
            if item.strip()
        }
        requested_interface = str(runtime.get("interface_reference") or runtime.get("bench_reference") or "").strip()
        if not requested_interface or requested_interface not in configured_interfaces:
            return RuntimeHealth.blocked(
                self.platform,
                "EMBEDDED_INTERFACE_NOT_APPROVED",
                f"Embedded interface is not approved for {protocol}: {requested_interface or '<empty>'}",
                components=(robot,),
                capabilities=capabilities,
            )
        ready = os.environ.get(f"{prefix}_READY", "false").strip().lower() in {"1", "true", "yes", "ready"}
        interface = ComponentHealth(
            ready=ready,
            name=f"{protocol.upper()} interface",
            endpoint=requested_interface,
            message=None if ready else f"{prefix}_READY is not true",
            error_code=None if ready else "EMBEDDED_INTERFACE_UNAVAILABLE",
        )
        if not ready:
            return RuntimeHealth.blocked(
                self.platform,
                interface.error_code or "EMBEDDED_INTERFACE_UNAVAILABLE",
                interface.message or "Embedded interface is unavailable",
                components=(robot, interface),
                capabilities=capabilities,
            )
        return RuntimeHealth(
            platform=self.platform,
            ready=True,
            status="READY",
            real_execution=True,
            simulated=False,
            target_connected=True,
            session_created=False,
            components=(robot, interface),
            capabilities=capabilities,
            checked_at=utc_now(),
            metadata={
                "protocol": protocol,
                "interface_reference": requested_interface,
                "bench_version": os.environ.get(f"{prefix}_BENCH_VERSION"),
            },
        )

    def before_execution(
        self,
        request: Any,
        workspace: pathlib.Path,
        output_directory: pathlib.Path,
        cancellation: threading.Event,
    ) -> Mapping[str, Any]:
        health = self.check(request.runtime)
        return {
            "protocol": health.metadata.get("protocol"),
            "interface_reference": health.metadata.get("interface_reference"),
            "device_version": health.metadata.get("bench_version"),
        }

    def platform_pass_requirements(
        self,
        health: RuntimeHealth,
        session_created: bool,
        artifacts: Sequence[Any],
    ) -> bool:
        return any(getattr(artifact, "type", None) == "protocol_trace" for artifact in artifacts)

    def device_version(self, context: Mapping[str, Any]) -> str | None:
        return _optional_text(context.get("device_version"))



def create_default_registry() -> ExecutorRegistry:
    runner = TrackedProcessRunner()
    return (
        ExecutorRegistry()
        .register(WindowsExecutor(runner))
        .register(LinuxExecutor(runner))
        .register(AndroidExecutor(runner))
        .register(EmbeddedExecutor(runner))
    )


def _executable_health(name: str, executable: str) -> ComponentHealth:
    try:
        resolved = resolve_executable(executable)
        return ComponentHealth(ready=True, name=name, endpoint=resolved)
    except ProcessExecutionError as exc:
        return ComponentHealth(
            ready=False,
            name=name,
            message=str(exc),
            error_code=exc.code,
        )


def _run_probe(arguments: Sequence[str], *, timeout: int, maximum_output: int = 1_000_000) -> tuple[int, str, str]:
    try:
        result = subprocess.run(
            list(arguments),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            timeout=timeout,
            check=False,
        )
        return (
            int(result.returncode),
            result.stdout[-maximum_output:].decode("utf-8", errors="replace"),
            result.stderr[-maximum_output:].decode("utf-8", errors="replace"),
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return (1, "", str(exc))


def _appium_url() -> str:
    value = os.environ.get("CYFAST_APPIUM_URL", "http://127.0.0.1:4723").strip().rstrip("/")
    if not re.fullmatch(r"https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?", value, re.I):
        raise ValueError("CYFAST_APPIUM_URL must be a loopback HTTP(S) URL")
    return value


def _http_status_ready(url: str) -> tuple[bool, str | None]:
    request = urllib.request.Request(url, method="GET", headers={"accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            body = response.read(1_000_000)
            if response.status < 200 or response.status >= 300:
                return False, f"status endpoint returned HTTP {response.status}"
            try:
                value = json.loads(body.decode("utf-8"))
                ready = value.get("value", {}).get("ready") if isinstance(value.get("value"), Mapping) else None
                return (ready is not False, None if ready is not False else "Appium reported not ready")
            except (json.JSONDecodeError, UnicodeDecodeError):
                return True, None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return False, str(exc)


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _nested_text(value: Mapping[str, Any], parent: str, child: str) -> str | None:
    nested = value.get(parent)
    if isinstance(nested, Mapping):
        return _optional_text(nested.get(child))
    return None


def _optional_text(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)
