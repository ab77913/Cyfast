"""Session storage for iterative regeneration (memory or file backend)."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from app.config import settings
from app.test_scripts.prompt_builder import build_regenerate_system_prompt

MessageDict = dict[str, str]


def _session_expired(created_at: str, ttl_hours: int) -> bool:
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return True
    if created.tzinfo:
        now = datetime.now(created.tzinfo)
    else:
        now = datetime.now()
    return now - created > timedelta(hours=ttl_hours)


def _ensure_file_dir() -> Path:
    path = Path(settings.test_scripts_session_file_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _session_file_path(session_id: str) -> Path:
    return _ensure_file_dir() / f"{session_id}.json"


class _InMemoryBackend:
    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}

    def get(self, session_id: str) -> Optional[dict[str, Any]]:
        data = self._store.get(session_id)
        if not data:
            return None
        if _session_expired(
            data["created_at"], settings.test_scripts_session_ttl_hours
        ):
            del self._store[session_id]
            return None
        return data

    def set(self, session_id: str, data: dict[str, Any]) -> None:
        self._store[session_id] = data

    def delete(self, session_id: str) -> None:
        self._store.pop(session_id, None)


class _FileBackend:
    def get(self, session_id: str) -> Optional[dict[str, Any]]:
        path = _session_file_path(session_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if _session_expired(
                data.get("created_at", ""),
                settings.test_scripts_session_ttl_hours,
            ):
                path.unlink(missing_ok=True)
                return None
            return data
        except (json.JSONDecodeError, OSError):
            return None

    def set(self, session_id: str, data: dict[str, Any]) -> None:
        path = _session_file_path(session_id)
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def delete(self, session_id: str) -> None:
        _session_file_path(session_id).unlink(missing_ok=True)


def _get_backend():
    if settings.test_scripts_session_backend == "file":
        return _FileBackend()
    return _InMemoryBackend()


_backend = _get_backend()


def create_session(
    metadata: dict[str, Any],
    initial_assistant_content: str,
) -> str:
    """Create a new session with initial generated script. Returns session_id."""
    session_id = str(uuid.uuid4())
    data = {
        "session_id": session_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "messages": [{"role": "assistant", "content": initial_assistant_content}],
        "metadata": metadata,
    }
    _backend.set(session_id, data)
    return session_id


def get_session(session_id: str) -> Optional[dict[str, Any]]:
    """Load session by id. Returns None if expired or not found."""
    return _backend.get(session_id)


def append_turn(
    session_id: str,
    user_content: str,
    assistant_content: str,
) -> None:
    """Append a user feedback and assistant response to the session."""
    data = _backend.get(session_id)
    if not data:
        raise ValueError(f"Session not found: {session_id}")
    data["messages"].append({"role": "user", "content": user_content})
    data["messages"].append({"role": "assistant", "content": assistant_content})
    _backend.set(session_id, data)


def _summarize_older_messages(
    messages: list[MessageDict], keep_recent: int
) -> tuple[list[MessageDict], list[MessageDict]]:
    pairs_to_keep = keep_recent * 2
    if len(messages) <= pairs_to_keep:
        return [], messages
    split = len(messages) - pairs_to_keep
    return messages[:split], messages[split:]


def _build_prior_feedback_message(
    older_messages: list[MessageDict],
) -> Optional[MessageDict]:
    user_contents = [m["content"] for m in older_messages if m.get("role") == "user"]
    if not user_contents:
        return None
    lines = ["Prior feedback (already addressed in script revisions):"]
    for content in user_contents:
        content = content.strip()
        if content:
            lines.append(f'- "{content}"')
    return {"role": "user", "content": "\n".join(lines)}


def get_messages_for_llm(
    session_id: str,
    user_comments: str,
    framework: str = "selenium_pytest",
) -> list[MessageDict]:
    """Build messages for chat completion including summarization when history is long."""
    data = _backend.get(session_id)
    if not data:
        raise ValueError(f"Session not found: {session_id}")

    messages = data["messages"]
    metadata = data.get("metadata", {})
    framework = metadata.get("framework", framework) or framework

    system_prompt = build_regenerate_system_prompt(framework=framework)
    max_before_summarize = settings.test_scripts_session_max_messages_before_summarize
    keep_recent = settings.test_scripts_session_recent_turns_to_keep

    current_user_content = (
        f"User feedback (address these points):\n\n{user_comments.strip()}"
    )

    if len(messages) <= max_before_summarize:
        return [
            {"role": "system", "content": system_prompt},
            *messages,
            {"role": "user", "content": current_user_content},
        ]

    older, recent = _summarize_older_messages(messages, keep_recent)
    prior_msg = _build_prior_feedback_message(older)
    result: list[MessageDict] = [{"role": "system", "content": system_prompt}]
    if prior_msg:
        result.append(prior_msg)
    result.extend(recent)
    result.append({"role": "user", "content": current_user_content})
    return result


def get_last_assistant_content(session_id: str) -> str:
    """Get the latest script (last assistant message) from the session."""
    data = _backend.get(session_id)
    if not data or not data.get("messages"):
        return ""
    msgs = data["messages"]
    if msgs[-1].get("role") == "assistant":
        return msgs[-1].get("content", "")
    return ""
