"""Chat completions via OpenAI-compatible HTTP or local/org Ollama — configurable per capability (see LLMProfile)."""

from __future__ import annotations

import json
import logging
from typing import Any, Literal, cast

import httpx

from app.config import settings
from app.shared.llm_profiles import LLMProfile

logger = logging.getLogger(__name__)


class LLMConfigurationError(RuntimeError):
    """Raised when the chosen provider is not configured (e.g. missing API key)."""


class LLMTransportError(RuntimeError):
    """Raised when the upstream LLM endpoint is unreachable or returns an error."""


def resolve_llm_execution(profile: LLMProfile) -> tuple[Literal["openai", "ollama"], str]:
    """
    Decide provider + model id for a capability.

    Per-profile env (examples):
      REQUIREMENTS_LLM_PROVIDER, REQUIREMENTS_OPENAI_MODEL, REQUIREMENTS_OLLAMA_MODEL
      VALIDATION_LLM_PROVIDER, VALIDATION_OPENAI_MODEL, VALIDATION_OLLAMA_MODEL
    Blank / unset provider → inherit LLM_PROVIDER. Blank model → inherit OPENAI_MODEL / OLLAMA_MODEL.
    """
    prefix = profile.value

    raw = getattr(settings, f"{prefix}_llm_provider", None)
    pv = (str(raw).strip().lower()) if raw is not None else ""
    if pv in ("", "inherit"):
        provider = cast(Literal["openai", "ollama"], settings.llm_provider)
    elif pv in ("openai", "ollama"):
        provider = cast(Literal["openai", "ollama"], pv)
    else:
        logger.warning(
            "Invalid %s_llm_provider=%r — falling back to LLM_PROVIDER", prefix, raw
        )
        provider = cast(Literal["openai", "ollama"], settings.llm_provider)

    if provider == "openai":
        ov = getattr(settings, f"{prefix}_openai_model", None)
        model = ov.strip() if isinstance(ov, str) and ov.strip() else settings.openai_model
    else:
        ov = getattr(settings, f"{prefix}_ollama_model", None)
        model = ov.strip() if isinstance(ov, str) and ov.strip() else settings.ollama_model

    return provider, model


def resolved_chat_model(profile: LLMProfile) -> str:
    """Model id applied for responses / diagnostics JSON."""
    return resolve_llm_execution(profile)[1]


def resolved_llm_provider(profile: LLMProfile) -> Literal["openai", "ollama"]:
    """Provider applied for ``profile``."""
    return resolve_llm_execution(profile)[0]


def resolve_ollama_base_url(profile: LLMProfile) -> str:
    """
    Ollama API root (no trailing slash) for POST /api/chat.

    Profiles may override ``OLLAMA_BASE_URL`` via ``{PROFILE}_OLLAMA_BASE_URL`` (currently
    ``test_scenarios_ollama_base_url`` → env ``TEST_SCENARIOS_OLLAMA_BASE_URL``).
    """
    if profile == LLMProfile.TEST_SCENARIOS:
        raw = settings.test_scenarios_ollama_base_url
        if isinstance(raw, str) and raw.strip():
            return raw.strip().rstrip("/")
    return settings.ollama_base_url.strip().rstrip("/")


def profile_llm_ready(profile: LLMProfile) -> bool:
    """True when the resolved stack can legally run one completion (keys / reachability aside)."""
    prov, _ = resolve_llm_execution(profile)
    if prov == "openai":
        return bool(settings.openai_api_key)
    return True


def rag_synthesis_ready() -> bool:
    """Whether RAG chat may attempt synthesis for its profile."""
    return profile_llm_ready(LLMProfile.RAG_CHAT)


def rag_tree_llm_ready() -> bool:
    """Whether tree routing may use LLM."""
    return profile_llm_ready(LLMProfile.RAG_TREE)


def llm_setup_hint() -> str:
    return (
        "Set LLM_PROVIDER=openai with OPENAI_API_KEY (OPENAI_*), or AZURE_KEY_VAULT_URL "
        "with vault secrets openai-key / openai-endpoint, or LLM_PROVIDER=ollama "
        "with OLLAMA_BASE_URL and OLLAMA_MODEL. Per-route *_LLM_PROVIDER=ollama overrides "
        "the global provider — remove or set to openai for Azure OpenAI. See ai_engine/.env.example."
    )


def _is_azure_openai_base_url(base_url: str) -> bool:
    return "openai.azure.com" in base_url.lower()


def _openai_chat_completions_url(base_url: str, model: str) -> str:
    """Public OpenAI uses /v1/chat/completions; Azure uses /openai/deployments/{model}/chat/completions."""
    base = base_url.rstrip("/")
    if _is_azure_openai_base_url(base):
        api_version = settings.openai_api_version.strip()
        return (
            f"{base}/openai/deployments/{model}/chat/completions"
            f"?api-version={api_version}"
        )
    return f"{base}/chat/completions"


async def _openai_compatible_chat(
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int | None,
    json_object: bool,
    model: str,
) -> str:
    if not settings.openai_api_key:
        raise LLMConfigurationError(
            "OPENAI_API_KEY is not set (required for OpenAI profile)"
        )

    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": messages,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if json_object:
        payload["response_format"] = {"type": "json_object"}

    url = _openai_chat_completions_url(settings.openai_base_url, model)
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if _is_azure_openai_base_url(settings.openai_base_url):
        headers["api-key"] = settings.openai_api_key
    else:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"

    timeout_sec = settings.llm_http_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        try:
            r = await client.post(url, headers=headers, content=json.dumps(payload))
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise LLMTransportError(
                f"OpenAI-compatible chat failed: HTTP {e.response.status_code}"
            ) from e
        except httpx.TimeoutException as e:
            raise LLMTransportError(
                f"OpenAI-compatible LLM timed out after ~{timeout_sec}s "
                f"({settings.openai_base_url}). Increase LLM_HTTP_TIMEOUT_SECONDS "
                f"for long generations/regeneration; keep general_management AI_ENGINE_LLMS_TIMEOUT_MS "
                f"higher still. Detail: {e}"
            ) from e
        except httpx.RequestError as e:
            raise LLMTransportError(
                f"OpenAI-compatible chat unreachable ({settings.openai_base_url}): {e}"
            ) from e

    data = r.json()
    choice = data.get("choices", [{}])[0]
    msg = choice.get("message") or {}
    text = msg.get("content")
    return (text or "").strip()


async def _ollama_chat(
    *,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int | None,
    json_object: bool,
    model: str,
    ollama_base_url: str,
) -> str:
    url = f"{ollama_base_url.rstrip('/')}/api/chat"
    opts: dict[str, Any] = {"temperature": temperature}
    if max_tokens is not None:
        opts["num_predict"] = max_tokens

    body: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": opts,
    }
    if json_object:
        body["format"] = "json"

    timeout_sec = settings.llm_http_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout_sec) as client:
        try:
            r = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                content=json.dumps(body),
            )
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            snippet = ""
            try:
                snippet = (e.response.text or "").strip().replace("\n", " ")
                if len(snippet) > 380:
                    snippet = snippet[:380] + "…"
            except Exception:
                pass
            msg = f"Ollama chat failed: HTTP {e.response.status_code}"
            if snippet:
                msg += f" — {snippet}"
            raise LLMTransportError(msg) from e
        except httpx.TimeoutException as e:
            raise LLMTransportError(
                f"Ollama timed out after ~{timeout_sec}s ({ollama_base_url}). "
                f"Increase LLM_HTTP_TIMEOUT_SECONDS if the model is slow on large regenerate payloads; "
                f"general_management AI_ENGINE_LLMS_TIMEOUT_MS must be >= that. Detail: {e}"
            ) from e
        except httpx.RequestError as e:
            root = ollama_base_url.rstrip("/")
            tag_probe = f"{root}/api/tags"
            raise LLMTransportError(
                f"Ollama unreachable ({ollama_base_url}): {e}. "
                f"Probe from this host (same box as ai_engine): curl -s {tag_probe}. "
                "On the Ollama machine set OLLAMA_HOST=0.0.0.0 if you connect by LAN IP "
                "and open TCP port 11434 through the firewall."
            ) from e

    data = r.json()
    msg = data.get("message") or {}
    text = msg.get("content")
    return (text or "").strip()


async def chat_completion(
    *,
    messages: list[dict[str, str]],
    profile: LLMProfile,
    temperature: float = 0.3,
    max_tokens: int | None = None,
    json_object: bool = False,
) -> str:
    provider, model = resolve_llm_execution(profile)
    if provider == "ollama":
        return await _ollama_chat(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            json_object=json_object,
            model=model,
            ollama_base_url=resolve_ollama_base_url(profile),
        )
    return await _openai_compatible_chat(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        json_object=json_object,
        model=model,
    )


def _extract_json_object(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(raw[start:end])
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Model did not return valid JSON: {e}") from e
    raise RuntimeError("Model did not return valid JSON")


async def chat_completion_json(
    *,
    messages: list[dict[str, str]],
    profile: LLMProfile,
    temperature: float = 0.2,
) -> dict[str, Any]:
    """Ask for a JSON object (OpenAI ``response_format`` or Ollama ``format: json``)."""
    raw = await chat_completion(
        messages=messages,
        profile=profile,
        temperature=temperature,
        json_object=True,
    )
    return _extract_json_object(raw)
