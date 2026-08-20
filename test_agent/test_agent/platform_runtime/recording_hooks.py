from __future__ import annotations

import pathlib
from typing import Any, Mapping

from .desktop_recorder import DesktopRecorder


_recorder = DesktopRecorder()


def recording_requested(request: Any) -> bool:
    policy = getattr(request, "evidence_policy", None) or {}
    return isinstance(policy, Mapping) and bool(policy.get("screen_recording"))


def start_desktop_recording(request: Any, workspace: Any, platform: str) -> None:
    if not recording_requested(request):
        return
    _recorder.start(
        execution_id=str(getattr(request, "execution_id")),
        platform=platform,
        output_directory=artifact_directory(workspace),
        maximum_seconds=int(getattr(request, "timeout_seconds", 900)) + 60,
    )


def stop_desktop_recording(request: Any) -> pathlib.Path | None:
    if not recording_requested(request):
        return None
    return _recorder.stop(str(getattr(request, "execution_id")))


def cancel_desktop_recording(request_or_execution_id: Any) -> None:
    execution_id = (
        str(getattr(request_or_execution_id, "execution_id"))
        if hasattr(request_or_execution_id, "execution_id")
        else str(request_or_execution_id)
    )
    _recorder.cancel(execution_id)


def artifact_directory(workspace: Any) -> pathlib.Path:
    for name in ("artifact_directory", "artifacts_directory", "artifacts", "output_directory"):
        value = getattr(workspace, name, None)
        if value:
            path = pathlib.Path(value)
            path.mkdir(parents=True, exist_ok=True)
            return path
    path = pathlib.Path(workspace)
    if path.name.lower() != "artifacts":
        path = path / "artifacts"
    path.mkdir(parents=True, exist_ok=True)
    return path
