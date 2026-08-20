from __future__ import annotations

import json
import os
import pathlib
import signal
import subprocess
import threading
from dataclasses import dataclass
from typing import Sequence

from .process_runner import ProcessExecutionError, resolve_executable


@dataclass(slots=True)
class RecordingHandle:
    execution_id: str
    process: subprocess.Popen[bytes]
    output_path: pathlib.Path
    stderr_path: pathlib.Path
    stderr_stream: object


class DesktopRecorder:
    """Starts only the locally configured ffmpeg executable with fixed platform capture arguments."""

    def __init__(self) -> None:
        self._handles: dict[str, RecordingHandle] = {}
        self._lock = threading.RLock()

    def start(
        self,
        *,
        execution_id: str,
        platform: str,
        output_directory: pathlib.Path,
        maximum_seconds: int,
    ) -> RecordingHandle:
        ffmpeg = resolve_executable(os.environ.get("CYFAST_FFMPEG_EXECUTABLE", "ffmpeg"))
        output_directory.mkdir(parents=True, exist_ok=True)
        output_path = output_directory / "screen-recording.mp4"
        stderr_path = output_directory / "screen-recording-ffmpeg.log"
        arguments = self._arguments(
            platform=platform,
            output_path=output_path,
            maximum_seconds=max(30, min(int(maximum_seconds), 86_400)),
        )
        stderr_stream = stderr_path.open("wb")
        try:
            process = subprocess.Popen(
                [ffmpeg, *arguments],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=stderr_stream,
                cwd=str(output_directory),
                shell=False,
                start_new_session=os.name != "nt",
            )
        except OSError as exc:
            stderr_stream.close()
            raise ProcessExecutionError(
                "SCREEN_RECORDING_START_FAILED",
                f"Desktop recorder could not be started: {exc}",
            ) from exc
        handle = RecordingHandle(execution_id, process, output_path, stderr_path, stderr_stream)
        with self._lock:
            previous = self._handles.pop(execution_id, None)
            self._handles[execution_id] = handle
        if previous is not None:
            self._stop_handle(previous)
        return handle

    def stop(self, execution_id: str) -> pathlib.Path | None:
        with self._lock:
            handle = self._handles.pop(execution_id, None)
        if handle is None:
            return None
        self._stop_handle(handle)
        if not handle.output_path.is_file() or handle.output_path.stat().st_size <= 0:
            raise ProcessExecutionError(
                "SCREEN_RECORDING_FAILED",
                "Desktop recorder did not produce a non-empty recording",
            )
        return handle.output_path

    def cancel(self, execution_id: str) -> None:
        with self._lock:
            handle = self._handles.pop(execution_id, None)
        if handle is not None:
            self._terminate_handle(handle)

    def _arguments(self, *, platform: str, output_path: pathlib.Path, maximum_seconds: int) -> list[str]:
        common = [
            "-hide_banner",
            "-loglevel",
            "warning",
            "-y",
        ]
        if platform.upper() == "WINDOWS":
            input_arguments = [
                "-f",
                "gdigrab",
                "-framerate",
                os.environ.get("CYFAST_RECORDING_FPS", "10"),
                "-i",
                "desktop",
            ]
        elif platform.upper() == "LINUX":
            input_arguments = self._linux_input_arguments()
        else:
            raise ProcessExecutionError(
                "SCREEN_RECORDING_PLATFORM_UNSUPPORTED",
                f"Desktop recording is not supported for platform {platform}",
            )
        return [
            *common,
            *input_arguments,
            "-t",
            str(maximum_seconds),
            "-an",
            "-c:v",
            os.environ.get("CYFAST_RECORDING_VIDEO_CODEC", "libx264"),
            "-preset",
            os.environ.get("CYFAST_RECORDING_PRESET", "ultrafast"),
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ]

    def _linux_input_arguments(self) -> list[str]:
        configured = os.environ.get("CYFAST_LINUX_RECORDING_INPUT_JSON", "").strip()
        if configured:
            try:
                value = json.loads(configured)
            except json.JSONDecodeError as exc:
                raise ProcessExecutionError(
                    "LINUX_RECORDING_CONFIGURATION_INVALID",
                    "CYFAST_LINUX_RECORDING_INPUT_JSON must be valid JSON",
                ) from exc
            if not isinstance(value, list) or not value or any(not isinstance(item, str) for item in value):
                raise ProcessExecutionError(
                    "LINUX_RECORDING_CONFIGURATION_INVALID",
                    "CYFAST_LINUX_RECORDING_INPUT_JSON must be a non-empty string array",
                )
            if len(value) > 64 or any(len(item) > 4096 or "\x00" in item for item in value):
                raise ProcessExecutionError(
                    "LINUX_RECORDING_CONFIGURATION_INVALID",
                    "Linux recording input arguments exceed safety limits",
                )
            return list(value)
        display = os.environ.get("DISPLAY", "").strip()
        if not display:
            raise ProcessExecutionError(
                "LINUX_DESKTOP_UNAVAILABLE",
                "DISPLAY is required for default X11 recording; configure CYFAST_LINUX_RECORDING_INPUT_JSON for an approved alternative",
            )
        return [
            "-f",
            "x11grab",
            "-framerate",
            os.environ.get("CYFAST_RECORDING_FPS", "10"),
            "-i",
            display,
        ]

    def _stop_handle(self, handle: RecordingHandle) -> None:
        try:
            if handle.process.poll() is None and handle.process.stdin is not None:
                handle.process.stdin.write(b"q\n")
                handle.process.stdin.flush()
                handle.process.wait(timeout=20)
        except (BrokenPipeError, OSError, subprocess.TimeoutExpired):
            self._terminate_process(handle.process)
        finally:
            try:
                handle.stderr_stream.close()
            except Exception:
                pass

    def _terminate_handle(self, handle: RecordingHandle) -> None:
        try:
            self._terminate_process(handle.process)
        finally:
            try:
                handle.stderr_stream.close()
            except Exception:
                pass

    @staticmethod
    def _terminate_process(process: subprocess.Popen[bytes]) -> None:
        if process.poll() is not None:
            return
        try:
            if os.name == "nt":
                process.terminate()
            else:
                os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            try:
                if os.name == "nt":
                    process.kill()
                else:
                    os.killpg(process.pid, signal.SIGKILL)
            except OSError:
                pass
