from __future__ import annotations

import base64
import json
import mimetypes
import pathlib
from datetime import datetime, timezone
from typing import Iterable, Mapping

from .contracts import Artifact, EvidencePolicy, sha256_bytes, utc_now


DEFAULT_ALLOWED_SUFFIXES = {
    ".xml",
    ".html",
    ".log",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".mp4",
    ".webm",
    ".asc",
    ".blf",
    ".pcap",
    ".pcapng",
    ".trc",
    ".json",
}


class EvidenceError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def collect_artifacts(
    directories: Iterable[pathlib.Path],
    policy: EvidencePolicy,
    *,
    started_at: str,
    finished_at: str,
    additional_metadata: Mapping[str, object] | None = None,
) -> tuple[Artifact, ...]:
    artifacts: list[Artifact] = []
    total = 0
    seen: set[pathlib.Path] = set()
    for directory in directories:
        if not directory.exists():
            continue
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.is_symlink():
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            if path.suffix.lower() not in DEFAULT_ALLOWED_SUFFIXES:
                continue
            size = path.stat().st_size
            if size < 0 or size > policy.maximum_artifact_bytes:
                continue
            if total + size > policy.maximum_artifact_bytes:
                continue
            content = path.read_bytes()
            total += len(content)
            artifact_type = classify_artifact(path)
            metadata = dict(additional_metadata or {})
            metadata["relative_path"] = path.name
            recording = artifact_type in {
                "screen_recording",
                "video_recording",
                "semantic_recording",
                "protocol_recording",
            }
            artifacts.append(
                Artifact(
                    type=artifact_type,
                    filename=safe_filename(path.name),
                    content_type=content_type(path),
                    content_base64=base64.b64encode(content).decode("ascii"),
                    size=len(content),
                    sha256=sha256_bytes(content),
                    captured_at=utc_now(),
                    retention_classification=policy.retention_classification,
                    redacted=True,
                    started_at=started_at if recording else None,
                    finished_at=finished_at if recording else None,
                    format=path.suffix.lstrip(".").lower() if recording else None,
                    metadata=metadata,
                )
            )
    return tuple(artifacts)


def write_runtime_proof(directory: pathlib.Path, proof: Mapping[str, object]) -> pathlib.Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "runtime-proof.json"
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(proof, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    temporary.replace(path)
    return path


def write_text_artifact(directory: pathlib.Path, filename: str, content: str) -> pathlib.Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / safe_filename(filename)
    path.write_text(content[-1_000_000:], encoding="utf-8", errors="replace")
    return path


def classify_artifact(path: pathlib.Path) -> str:
    name = path.name.lower()
    suffix = path.suffix.lower()
    if name == "output.xml":
        return "output_xml"
    if name == "log.html":
        return "robot_log"
    if name == "report.html":
        return "robot_report"
    if name in {"stdout.log", "stderr.log", "execution.log"}:
        return "execution_log"
    if name == "runtime-proof.json":
        return "runtime_proof"
    if "logcat" in name or name == "device.log":
        return "device_log"
    if suffix in {".png", ".jpg", ".jpeg"}:
        return "screenshot"
    if suffix in {".mp4", ".webm"}:
        return "screen_recording"
    if suffix in {".asc", ".blf", ".pcap", ".pcapng", ".trc"}:
        return "protocol_trace"
    if "semantic-recording" in name:
        return "semantic_recording"
    return "execution_artifact"


def content_type(path: pathlib.Path) -> str:
    explicit = {
        ".xml": "application/xml",
        ".html": "text/html; charset=utf-8",
        ".log": "text/plain; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".json": "application/json",
        ".asc": "text/plain; charset=utf-8",
        ".blf": "application/octet-stream",
        ".pcap": "application/vnd.tcpdump.pcap",
        ".pcapng": "application/x-pcapng",
        ".trc": "text/plain; charset=utf-8",
    }
    return explicit.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def safe_filename(value: str) -> str:
    text = "".join("_" if character in '\\/:*?\"<>|\r\n' else character for character in str(value))
    return text[:255] or "artifact.bin"
