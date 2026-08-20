from __future__ import annotations

import base64
import dataclasses
import hashlib
import mimetypes
import pathlib
from typing import Any, Iterable


def append_recording_artifact(result: Any, path: pathlib.Path | None) -> Any:
    if path is None or not path.is_file() or path.stat().st_size <= 0:
        return result
    artifacts_value = getattr(result, "artifacts", None)
    if artifacts_value is None:
        return result
    artifacts = list(artifacts_value)
    if any(str(getattr(item, "artifact_type", "")).lower() == "screen_recording" for item in artifacts):
        return result
    if not artifacts:
        return result
    artifact_type = type(artifacts[0])
    if not dataclasses.is_dataclass(artifact_type):
        return result
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    values = {
        "artifact_type": "screen_recording",
        "type": "screen_recording",
        "filename": path.name,
        "file_name": path.name,
        "content_type": mimetypes.guess_type(path.name)[0] or "video/mp4",
        "mime_type": mimetypes.guess_type(path.name)[0] or "video/mp4",
        "size_bytes": len(raw),
        "size": len(raw),
        "sha256": digest,
        "content_hash": digest,
        "content_base64": base64.b64encode(raw).decode("ascii"),
        "data_base64": base64.b64encode(raw).decode("ascii"),
        "relative_path": path.name,
        "path": path.name,
    }
    kwargs = {}
    for field in dataclasses.fields(artifact_type):
        if field.name in values:
            kwargs[field.name] = values[field.name]
        elif field.default is dataclasses.MISSING and field.default_factory is dataclasses.MISSING:  # type: ignore[attr-defined]
            return result
    try:
        artifact = artifact_type(**kwargs)
    except (TypeError, ValueError):
        return result
    artifacts.append(artifact)
    replacement = tuple(artifacts) if isinstance(artifacts_value, tuple) else artifacts
    if dataclasses.is_dataclass(result):
        try:
            return dataclasses.replace(result, artifacts=replacement)
        except TypeError:
            return result
    try:
        setattr(result, "artifacts", replacement)
    except (AttributeError, TypeError):
        return result
    return result
