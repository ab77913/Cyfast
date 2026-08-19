"""Load secrets from Azure Key Vault (DefaultAzureCredential)."""

from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Settings field → default Key Vault secret name.
OPENAI_SECRET_BINDINGS: dict[str, str] = {
    "openai_api_key": "openai-key",
    "openai_base_url": "openai-endpoint",
}

# Env var that, when set, blocks Key Vault override for that settings field.
OPENAI_ENV_OVERRIDES: dict[str, str] = {
    "openai_api_key": "OPENAI_API_KEY",
    "openai_base_url": "OPENAI_BASE_URL",
}


def _normalize_endpoint(value: str) -> str:
    return value.strip().strip("\"'").rstrip("/")


def fetch_key_vault_secrets(vault_url: str, secret_names: list[str]) -> dict[str, str]:
    """Return ``{secret_name: value}`` for secrets that exist and are non-empty."""
    try:
        from azure.identity import DefaultAzureCredential
        from azure.keyvault.secrets import SecretClient
    except ImportError as e:
        raise RuntimeError(
            "Azure Key Vault is configured (AZURE_KEY_VAULT_URL) but azure-identity / "
            "azure-keyvault-secrets are not installed. Run: pip install -r requirements.txt"
        ) from e

    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=vault_url.rstrip("/"), credential=credential)

    out: dict[str, str] = {}
    for name in secret_names:
        try:
            secret = client.get_secret(name)
            if secret.value and str(secret.value).strip():
                out[name] = str(secret.value).strip()
        except Exception as e:
            logger.warning("Key Vault secret %r not loaded: %s", name, e)
    return out


def _resolve_secret_bindings(settings_obj: Any) -> dict[str, str]:
    return {
        "openai_api_key": str(
            getattr(settings_obj, "azure_key_vault_openai_key_secret", "openai-key")
        ).strip()
        or "openai-key",
        "openai_base_url": str(
            getattr(settings_obj, "azure_key_vault_openai_endpoint_secret", "openai-endpoint")
        ).strip()
        or "openai-endpoint",
    }


def apply_openai_key_vault_secrets(
    settings_obj: Any,
    *,
    fields_set: set[str] | None = None,
) -> None:
    """
    Fill OpenAI-related settings from Key Vault when the vault URL is set.

    Fields already set via env / .env (``model_fields_set``) or non-empty
    ``openai_api_key`` are not overridden.
    """
    vault_url = getattr(settings_obj, "azure_key_vault_url", None)
    if not isinstance(vault_url, str) or not vault_url.strip():
        return

    explicit = fields_set or set()

    bindings = _resolve_secret_bindings(settings_obj)
    secret_names = list(dict.fromkeys(bindings.values()))
    secrets = fetch_key_vault_secrets(vault_url.strip(), secret_names)

    for field, secret_name in bindings.items():
        value = secrets.get(secret_name)
        if not value:
            continue

        if field == "openai_api_key":
            if getattr(settings_obj, field, None):
                continue
        elif field == "openai_base_url":
            if field in explicit or os.environ.get(OPENAI_ENV_OVERRIDES[field]):
                continue
        else:
            env_key = OPENAI_ENV_OVERRIDES.get(field)
            if env_key and os.environ.get(env_key):
                continue

        if field == "openai_base_url":
            setattr(settings_obj, field, _normalize_endpoint(value))
        else:
            setattr(settings_obj, field, value.strip().strip("\"'"))

    logger.info(
        "OpenAI settings loaded from Azure Key Vault %s (secrets: %s)",
        vault_url.strip(),
        ", ".join(secret_names),
    )
