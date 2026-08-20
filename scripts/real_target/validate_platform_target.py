#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Mapping


TERMINAL = {"PASSED", "FAILED", "BLOCKED", "CANCELLED"}
REQUIRED_ARTIFACTS = {
    "WINDOWS": {"execution_log", "output_xml", "runtime_proof", "screenshot", "screen_recording"},
    "LINUX": {"execution_log", "output_xml", "runtime_proof", "screenshot", "screen_recording"},
    "ANDROID": {"execution_log", "output_xml", "runtime_proof", "screenshot", "screen_recording", "device_log"},
    "EMBEDDED": {"execution_log", "output_xml", "runtime_proof", "protocol_trace"},
}


class AcceptanceError(RuntimeError):
    pass


class Client:
    def __init__(self, base_url: str, token: str, *, insecure: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.context = ssl._create_unverified_context() if insecure else ssl.create_default_context()

    def request(self, method: str, path: str, body: Mapping[str, Any] | None = None) -> Mapping[str, Any]:
        data = json.dumps(body, separators=(",", ":")).encode("utf-8") if body is not None else None
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={
                "authorization": f"Bearer {self.token}",
                "accept": "application/json",
                **({"content-type": "application/json"} if data is not None else {}),
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=120, context=self.context) as response:
                payload = response.read(64 * 1024 * 1024)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            raise AcceptanceError(f"HTTP {exc.code} from {path}: {detail}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise AcceptanceError(f"Target request failed for {path}: {exc}") from exc
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AcceptanceError(f"Target returned invalid JSON for {path}") from exc
        if not isinstance(value, Mapping):
            raise AcceptanceError(f"Target response for {path} must be an object")
        return value


def load_request(path: pathlib.Path, platform: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AcceptanceError(f"Execution request file is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise AcceptanceError("Execution request file must contain a JSON object")
    value["platform"] = platform
    value.setdefault("execution_id", f"real-{platform.lower()}-{int(time.time())}")
    value.setdefault("correlation_id", value["execution_id"])
    value.setdefault("timeout_seconds", 1800)
    value.setdefault(
        "evidence_policy",
        {
            "screen_recording": platform in {"WINDOWS", "LINUX", "ANDROID"},
            "screenshots": platform in {"WINDOWS", "LINUX", "ANDROID"},
            "device_logs": platform == "ANDROID",
            "protocol_trace": platform == "EMBEDDED",
        },
    )
    return value


def validate_runtime(platform: str, value: Mapping[str, Any]) -> None:
    if value.get("ready") is not True:
        raise AcceptanceError(f"Runtime is not ready: {value.get('error_code') or value.get('message') or value}")
    if value.get("simulated") is True:
        raise AcceptanceError("Runtime readiness response is simulated")
    if value.get("real_execution") is not True:
        raise AcceptanceError("Runtime did not identify itself as a real execution target")
    if value.get("target_connected") is not True:
        raise AcceptanceError("Runtime target is not connected")
    if platform in {"WINDOWS", "ANDROID"} and value.get("session_created") is not True:
        raise AcceptanceError(f"{platform} runtime did not prove a real automation session")


def validate_result(platform: str, value: Mapping[str, Any], output_directory: pathlib.Path) -> dict[str, Any]:
    status = str(value.get("status") or "").upper()
    if status != "PASSED":
        raise AcceptanceError(
            f"Real execution did not pass: status={status}, classification={value.get('failure_classification')}, message={value.get('failure_message')}"
        )
    checks = {
        "real_execution": value.get("real_execution") is True,
        "simulated_false": value.get("simulated") is False,
        "target_connected": value.get("target_connected") is True,
        "session_created": platform not in {"WINDOWS", "ANDROID"} or value.get("session_created") is True,
        "exit_code_zero": int(value.get("exit_code", -1)) == 0,
        "meaningful_actions": int(value.get("meaningful_actions", 0)) > 0,
        "meaningful_assertions": int(value.get("meaningful_assertions", 0)) > 0,
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise AcceptanceError("Truthful PASS proof failed: " + ", ".join(failed))

    artifacts = value.get("artifacts")
    if not isinstance(artifacts, list):
        raise AcceptanceError("Execution result has no artifacts array")
    output_directory.mkdir(parents=True, exist_ok=True)
    artifact_types: set[str] = set()
    artifact_summary: list[dict[str, Any]] = []
    total_bytes = 0
    for index, artifact in enumerate(artifacts, start=1):
        if not isinstance(artifact, Mapping):
            raise AcceptanceError(f"Artifact {index} is not an object")
        artifact_type = str(artifact.get("artifact_type") or artifact.get("type") or "").lower()
        filename = safe_filename(str(artifact.get("filename") or f"artifact-{index}.bin"))
        encoded = artifact.get("content_base64")
        if not isinstance(encoded, str):
            raise AcceptanceError(f"Artifact {filename} does not contain inline content_base64")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except ValueError as exc:
            raise AcceptanceError(f"Artifact {filename} is not valid base64") from exc
        expected_size = int(artifact.get("size_bytes") or artifact.get("size") or -1)
        expected_hash = str(artifact.get("sha256") or artifact.get("content_hash") or "").lower()
        actual_hash = hashlib.sha256(raw).hexdigest()
        if expected_size != len(raw):
            raise AcceptanceError(f"Artifact {filename} size mismatch: expected {expected_size}, got {len(raw)}")
        if expected_hash != actual_hash:
            raise AcceptanceError(f"Artifact {filename} checksum mismatch")
        total_bytes += len(raw)
        if total_bytes > 128 * 1024 * 1024:
            raise AcceptanceError("Returned artifacts exceed the 128 MiB acceptance limit")
        destination = output_directory / f"{index:03d}-{artifact_type or 'artifact'}-{filename}"
        destination.write_bytes(raw)
        artifact_types.add(artifact_type)
        artifact_summary.append(
            {
                "artifact_type": artifact_type,
                "filename": destination.name,
                "size_bytes": len(raw),
                "sha256": actual_hash,
            }
        )

    missing = REQUIRED_ARTIFACTS[platform] - artifact_types
    if missing:
        raise AcceptanceError("Required real evidence is missing: " + ", ".join(sorted(missing)))
    summary = {
        "platform": platform,
        "execution_id": value.get("execution_id"),
        "status": status,
        "proof_checks": checks,
        "artifact_types": sorted(artifact_types),
        "artifacts": artifact_summary,
        "proof_hash": value.get("proof_hash"),
        "finished_at": value.get("finished_at"),
    }
    (output_directory / "acceptance-summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return summary


def safe_filename(value: str) -> str:
    normalized = "".join("_" if character in '\\/:*?\"<>|\r\n' else character for character in value)
    return normalized[:255] or "artifact.bin"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a real CyFAST platform target and its evidence")
    parser.add_argument("--platform", required=True, choices=sorted(REQUIRED_ARTIFACTS))
    parser.add_argument("--base-url", default=os.environ.get("CYFAST_REAL_TARGET_URL", ""))
    parser.add_argument("--token", default=os.environ.get("CYFAST_REAL_TARGET_TOKEN", ""))
    parser.add_argument("--request", type=pathlib.Path, default=os.environ.get("CYFAST_REAL_REQUEST_FILE"))
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("real-target-evidence"))
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--insecure", action="store_true")
    args = parser.parse_args()
    platform = args.platform.upper()
    if not args.base_url:
        raise AcceptanceError("--base-url or CYFAST_REAL_TARGET_URL is required")
    if len(args.token) < 32:
        raise AcceptanceError("--token or CYFAST_REAL_TARGET_TOKEN must contain at least 32 characters")
    if not args.request or not pathlib.Path(args.request).is_file():
        raise AcceptanceError("--request or CYFAST_REAL_REQUEST_FILE must reference a pre-provisioned request JSON file")
    client = Client(args.base_url, args.token, insecure=args.insecure)
    request_value = load_request(pathlib.Path(args.request), platform)
    runtime = client.request(
        "POST",
        f"/v1/{platform.lower()}/runtime/check",
        {"configuration": request_value.get("runtime") or {}},
    )
    validate_runtime(platform, runtime)
    accepted = client.request("POST", f"/v1/{platform.lower()}/executions", request_value)
    execution_id = str(accepted.get("execution_id") or request_value["execution_id"])
    deadline = time.monotonic() + int(request_value.get("timeout_seconds", 1800)) + 120
    result: Mapping[str, Any] = accepted
    while str(result.get("status") or "").upper() not in TERMINAL:
        if time.monotonic() >= deadline:
            try:
                client.request("POST", f"/v1/{platform.lower()}/executions/{execution_id}/cancel", {})
            finally:
                raise AcceptanceError("Real target execution exceeded its acceptance timeout")
        time.sleep(max(0.5, min(args.poll_seconds, 10.0)))
        result = client.request("GET", f"/v1/{platform.lower()}/executions/{execution_id}")
    output = args.output / platform.lower() / execution_id
    summary = validate_result(platform, result.get("result") if isinstance(result.get("result"), Mapping) else result, output)
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AcceptanceError as exc:
        print(json.dumps({"status": "FAILED", "message": str(exc)}, indent=2), file=sys.stderr)
        raise SystemExit(1)
