from __future__ import annotations

import difflib
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping

from .policy import RepairPolicyError, validate_repair


class ScriptRepairUnavailable(RuntimeError):
    pass


class ScriptRepairResponseError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class ScriptRepairProposal:
    proposed_script: str
    rationale: str
    changes: tuple[str, ...]
    unified_diff: str
    model: str
    validation: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "proposed_script": self.proposed_script,
            "rationale": self.rationale,
            "changes": list(self.changes),
            "unified_diff": self.unified_diff,
            "model": self.model,
            "validation": dict(self.validation),
            "approval_required": True,
            "automatic_rerun": False,
        }


class ScriptRepairService:
    def __init__(
        self,
        *,
        endpoint: str | None = None,
        model: str | None = None,
        timeout_seconds: int = 120,
    ) -> None:
        self.endpoint = (endpoint or os.environ.get("CYFAST_LOCAL_LLM_URL") or "http://127.0.0.1:11434/api/chat").strip()
        self.model = (model or os.environ.get("CYFAST_SCRIPT_REPAIR_MODEL") or "qwen3:14b").strip()
        self.timeout_seconds = max(10, min(int(timeout_seconds), 300))
        self._validate_endpoint()

    def propose(
        self,
        *,
        failure_classification: str,
        attempt_number: int,
        platform: str,
        before_script: str,
        failure_message: str,
        evidence_summary: Mapping[str, Any] | None = None,
        target_context: Mapping[str, Any] | None = None,
    ) -> ScriptRepairProposal:
        preflight = validate_repair(
            failure_classification=failure_classification,
            attempt_number=attempt_number,
            before_script=before_script,
            after_script=before_script,
        )
        if not preflight.valid:
            raise RepairPolicyError(list(preflight.errors))
        request = self._request_body(
            failure_classification=failure_classification,
            attempt_number=attempt_number,
            platform=platform,
            before_script=before_script,
            failure_message=failure_message,
            evidence_summary=redact(evidence_summary or {}),
            target_context=redact(target_context or {}),
        )
        response = self._invoke(request)
        content = extract_content(response)
        parsed = parse_json_object(content)
        proposed_script = str(parsed.get("proposed_script") or "").strip()
        rationale = str(parsed.get("rationale") or "").strip()
        raw_changes = parsed.get("changes")
        changes = tuple(str(item).strip() for item in raw_changes) if isinstance(raw_changes, list) else ()
        if not proposed_script or not rationale or not changes:
            raise ScriptRepairResponseError("Model response must include proposed_script, rationale, and non-empty changes")
        validation = validate_repair(
            failure_classification=failure_classification,
            attempt_number=attempt_number,
            before_script=before_script,
            after_script=proposed_script,
            proposed_changes=changes,
            raise_on_error=True,
        )
        diff = "\n".join(
            difflib.unified_diff(
                before_script.splitlines(),
                proposed_script.splitlines(),
                fromfile="before.robot",
                tofile="proposed.robot",
                lineterm="",
            )
        )
        if not diff:
            raise ScriptRepairResponseError("Repair model returned an unchanged script")
        return ScriptRepairProposal(
            proposed_script=proposed_script,
            rationale=rationale,
            changes=changes,
            unified_diff=diff,
            model=self.model,
            validation=validation.to_dict(),
        )

    def _request_body(self, **context: Any) -> dict[str, Any]:
        system = """You are the CyFAST deterministic test-script repair agent.
Return JSON only with keys proposed_script, rationale, and changes.
You may repair only locator strategy, bounded waits/timing, keyword arguments, missing package-local imports, or attach/navigation mechanics.
Never delete, weaken, comment out, or convert assertions to warnings.
Never remove business actions or replace them with logging.
Never fabricate PASS, expected output, screenshots, recordings, protocol traces, or execution evidence.
Never introduce shell execution, host-specific absolute paths, plaintext credentials, unsafe file access, or legacy Appium desiredCapabilities.
Use semantic locators before coordinates. Keep secrets as environment references. Preserve the complete Robot Framework structure.
The repaired script will be validated, reviewed, versioned, and approved before any rerun."""
        user = {
            "task": "Propose one minimal bounded repair for the supplied Robot Framework script",
            **context,
            "required_response_schema": {
                "proposed_script": "complete repaired Robot Framework script",
                "rationale": "why the change addresses the classified automation defect",
                "changes": ["specific minimal change"],
            },
        }
        return {
            "model": self.model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user, ensure_ascii=False, sort_keys=True)},
            ],
            "options": {
                "temperature": 0.1,
                "top_p": 0.8,
                "num_predict": 8192,
            },
        }

    def _invoke(self, body: Mapping[str, Any]) -> Mapping[str, Any]:
        request = urllib.request.Request(
            self.endpoint,
            data=json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            method="POST",
            headers={"content-type": "application/json", "accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                payload = response.read(16 * 1024 * 1024)
                if response.status < 200 or response.status >= 300:
                    raise ScriptRepairUnavailable(f"Local LLM returned HTTP {response.status}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ScriptRepairUnavailable(f"Local script-repair model is unavailable: {exc}") from exc
        try:
            value = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ScriptRepairResponseError("Local LLM returned invalid JSON") from exc
        if not isinstance(value, Mapping):
            raise ScriptRepairResponseError("Local LLM response must be an object")
        return value

    def _validate_endpoint(self) -> None:
        if not re.fullmatch(
            r"https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?/[A-Za-z0-9_./-]+",
            self.endpoint,
            re.I,
        ):
            raise ValueError("CYFAST_LOCAL_LLM_URL must be an absolute loopback HTTP(S) endpoint")


def extract_content(value: Mapping[str, Any]) -> str:
    message = value.get("message")
    if isinstance(message, Mapping) and isinstance(message.get("content"), str):
        return message["content"]
    if isinstance(value.get("response"), str):
        return value["response"]
    raise ScriptRepairResponseError("Local LLM response does not contain message.content or response")


def parse_json_object(value: str) -> Mapping[str, Any]:
    text = value.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ScriptRepairResponseError("Script repair content is not valid JSON") from exc
    if not isinstance(parsed, Mapping):
        raise ScriptRepairResponseError("Script repair content must be a JSON object")
    return parsed


def redact(value: Any) -> Any:
    if isinstance(value, list):
        return [redact(item) for item in value]
    if not isinstance(value, Mapping):
        return value
    output: dict[str, Any] = {}
    for key, item in value.items():
        if re.search(r"password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key", str(key), re.I):
            output[str(key)] = "[REDACTED]"
        else:
            output[str(key)] = redact(item)
    return output


_service: ScriptRepairService | None = None


def get_script_repair_service() -> ScriptRepairService:
    global _service
    if _service is None:
        _service = ScriptRepairService()
    return _service
