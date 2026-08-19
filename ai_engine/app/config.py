from typing import Annotated, Literal, Self

from pydantic import BeforeValidator, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.shared.azure_keyvault import apply_openai_key_vault_secrets


def _strip_or_none(value: object) -> object:
    """Strip env strings — empty after strip becomes None so global LLM_PROVIDER is inherited."""
    if isinstance(value, str):
        s = value.strip().strip("\"'")  # common .env typo: wrapping quotes
        return s if s else None
    return value


def _normalize_ollama_http_root(value: object) -> object:
    """
    Optional per-route OLLAMA base URLs: strip ``/api`` suffix so callers do not end up at /api/api/chat (HTTP 404).
    """
    v = _strip_or_none(value)
    if not isinstance(v, str):
        return v
    u = v.rstrip("/")
    lower = u.lower()
    while lower.endswith("/api"):
        u = u[: -len("/api")].rstrip("/")
        lower = u.lower()
    return u


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_engine_host: str = "0.0.0.0"
    ai_engine_port: int = 8099

    # Azure Key Vault — OpenAI credentials (secrets openai-key, openai-endpoint).
    # OPENAI_API_KEY / OPENAI_BASE_URL in the process environment override vault values.
    azure_key_vault_url: Annotated[str | None, BeforeValidator(_strip_or_none)] = None
    azure_key_vault_openai_key_secret: str = "openai-key"
    azure_key_vault_openai_endpoint_secret: str = "openai-endpoint"

    mongodb_uri: str = "mongodb://localhost:27017/cyfast_general"

    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = "HeliConia6*"
    mysql_database: str = "cyfast3"

    # LLM_PROVIDER=openai → OPENAI_* ; LLM_PROVIDER=ollama → OLLAMA_* (local or internal server)
    llm_provider: Literal["openai", "ollama"] = "ollama"

    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    # Azure OpenAI: api-version query param when base URL is *.openai.azure.com
    openai_api_version: str = "2024-08-01-preview"

    ollama_base_url: str = "http://192.168.1.8:11434"
    ollama_model: str = "mistral:latest"

    # ── Optional per-capacity LLM selection (env prefix matches field name).
    # *_llm_provider: unset / empty / inherit → use global LLM_PROVIDER.
    # Example: VALIDATION_LLM_PROVIDER=ollama VALIDATION_OLLAMA_MODEL=llama3.1:8b
    # Example: REQUIREMENTS_OPENAI_MODEL=gpt-4.1  (inherits OpenAI provider)
    requirements_llm_provider: str | None = None
    requirements_openai_model: str | None = None
    requirements_ollama_model: str | None = None

    test_scenarios_llm_provider: Annotated[str | None, BeforeValidator(_strip_or_none)] = None
    test_scenarios_openai_model: Annotated[str | None, BeforeValidator(_strip_or_none)] = None
    test_scenarios_ollama_model: Annotated[str | None, BeforeValidator(_strip_or_none)] = None
    # Override Ollama HTTP root for /v1/test_scenarios/* only (omit trailing `/api`; use host:port root only).
    test_scenarios_ollama_base_url: Annotated[
        str | None, BeforeValidator(_normalize_ollama_http_root)
    ] = None

    test_cases_llm_provider: str | None = None
    test_cases_openai_model: str | None = None
    test_cases_ollama_model: str | None = None

    test_data_llm_provider: str | None = None
    test_data_openai_model: str | None = None
    test_data_ollama_model: str | None = None

    traceability_llm_provider: str | None = None
    traceability_openai_model: str | None = None
    traceability_ollama_model: str | None = None

    validation_llm_provider: str | None = None
    validation_openai_model: str | None = None
    validation_ollama_model: str | None = None

    rag_chat_llm_provider: str | None = None
    rag_chat_openai_model: str | None = None
    rag_chat_ollama_model: str | None = None

    rag_tree_llm_provider: str | None = None
    rag_tree_openai_model: str | None = None
    rag_tree_ollama_model: str | None = None

    test_scripts_llm_provider: str | None = None
    test_scripts_openai_model: str | None = None
    test_scripts_ollama_model: str | None = None

    rag_text_weight: float = 1.0
    rag_tree_weight: float = 0.85

    # Upstream HTTP timeout for each LLM completion (OpenAI-compatible + Ollama).
    llm_http_timeout_seconds: float = Field(default=480.0, ge=30.0, le=7200.0)

    # Mongoose default collection name for projectDocumentChunk model
    chunks_collection: str = "project_document_chunks"

    # Optional: require X-Internal-Key on /v1/requirements|traceability|test_cases|test_data routes
    internal_api_key: str | None = None
    # Per-IP requests per rolling minute; 0 disables rate limiting for QA automation routes
    rate_limit_per_minute: int = 60

    # test_scripts (/v1/test_script/*) — merged from Test_Automator service
    test_scripts_session_backend: Literal["memory", "file"] = "memory"
    test_scripts_session_ttl_hours: int = 24
    test_scripts_session_file_dir: str = "data/test_scripts_sessions"
    test_scripts_session_max_messages_before_summarize: int = 8
    test_scripts_session_recent_turns_to_keep: int = 2

    @field_validator("ollama_base_url", mode="before")
    @classmethod
    def _normalize_default_ollama_base_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        s = value.strip().strip("\"'")
        normalized = _normalize_ollama_http_root(s)
        return normalized if isinstance(normalized, str) and normalized.strip() else s

    @field_validator("llm_provider", mode="before")
    @classmethod
    def _normalize_llm_provider(cls, v: object) -> object:
        if v is None:
            return "openai"
        if isinstance(v, str):
            x = v.strip().lower()
            if x in ("openai", "ollama"):
                return x
            raise ValueError("LLM_PROVIDER must be 'openai' or 'ollama'")
        return v

    @model_validator(mode="after")
    def _load_openai_from_key_vault(self) -> Self:
        apply_openai_key_vault_secrets(self, fields_set=self.model_fields_set)
        return self


settings = Settings()
