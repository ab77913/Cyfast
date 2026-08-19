# AI Engine API

**Path:** `ai_engine/`  
**Runtime:** Python **FastAPI**  
**Default URL:** `http://127.0.0.1:8099` (`AI_ENGINE_HOST`, `AI_ENGINE_PORT` in `ai_engine/.env.example`)  
**Role:** LLM-backed generation, vectorless hybrid RAG, and validation rubrics. **Not** routed through `apis/api_gateway/`; General Management calls it via `AI_ENGINE_URL`.

**Behavior and data flow:** [AI-assisted generation — architecture](../architecture-ai-generation.md).

## Discovery

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Service name and link to `/docs` |
| `GET` | `/docs` | Swagger UI (FastAPI) |
| `GET` | `/redoc` | ReDoc |

Optional internal auth: `X-Internal-Key` when `AI_ENGINE_INTERNAL_KEY` is set (`app/shared/dependencies.py`).

## RAG — prefix `/v1`

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/v1/rag/search` | Hybrid retrieval: MongoDB text + PageIndex tree traversal; body `project_id`, `query`, optional filters (`doc_types`, `project_document_ids`, `top_k`, tree limits, `use_llm_tree`). |
| `POST` | `/v1/rag/chat` | Search + LLM answer synthesis (or extractive fallback). |

## Requirements — prefix `/v1`

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/v1/requirements/generate` | Topic/constraints generation (not proxied by GM HTTP today). |
| `POST` | `/v1/requirements/generate_from_documents` | Used by GM requirement jobs. |
| `POST` | `/v1/requirements/regenerate_from_documents` | Regenerate with feedback / prior context. |

## Test scenarios — prefix `/v1`

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/v1/test_scenarios/generate_from_requirements` | Used by GM test scenario jobs. |
| `POST` | `/v1/test_scenarios/regenerate_from_requirements` | Regenerate selected drafts. |

## Test cases — prefix `/v1`

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/v1/test_cases/generate` | LLM test-case drafts; **no** GM HTTP wrapper yet. |

## Generation validation — prefix `/v1`

| Method | Path | GM proxy |
|--------|------|----------|
| `POST` | `/v1/generation_validation/requirements` | `POST /generation_validation/requirements` |
| `POST` | `/v1/generation_validation/test_cases` | `POST /generation_validation/test_cases` |
| `POST` | `/v1/generation_validation/other` | `POST /generation_validation/other` |

## Other routers (existing platform)

Registered in `ai_engine/app/main.py` for traceability, test data, and script generation: `/v1/traceability/*`, `/v1/test_data/*`, `/v1/test_script/*` (see FastAPI `/docs` for live operation list).

## Internal

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/internal/documents/indexed` | Called by GM after `project_document.status = INDEXED`. |

## Source files

- Entry: `ai_engine/app/main.py`
- Routers: `app/requirements/`, `app/test_scenarios/`, `app/test_cases/`, `app/generation_validation/`, `app/routers/rag.py`, `app/routers/internal.py`
- Prompts: `app/shared/prompts.py`; LLM: `app/shared/llm.py`, `app/shared/llm_profiles.py`
