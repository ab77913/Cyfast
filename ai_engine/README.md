# CyFast AI Engine (Python)

FastAPI service for **vectorless RAG** over project documents stored by `apis/general_management`:

- **Strategy A — MongoDB `$text`:** full-text search on `heading`, `summary`, and `content` of chunk nodes, with structural filters (`project_id`, `organization_id`, `doc_type`, `project_document_id`).
- **Strategy C — PageIndex tree traversal:** walk each document tree (`DOCUMENT` → `SECTION` → `CHUNK`); optionally score branches with an **LLM** when configured (`LLM_PROVIDER=openai` + `OPENAI_API_KEY`, or `LLM_PROVIDER=ollama` + `OLLAMA_*`). Otherwise lexical scoring matches the Node fallback.

## Run

```bash
cd ai_engine
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env     # edit MONGODB_URI + MySQL + LLM_PROVIDER / OPENAI_* or OLLAMA_*

uvicorn app.main:app --host 0.0.0.0 --port 8099 --reload
```

Health: `GET http://localhost:8099/health` and `GET http://localhost:8099/docs`.

## API

- `POST /v1/rag/search` — body matches `general_management` `/project_documents/search` (snake_case: `project_id`, `query`, `doc_types`, `project_document_ids`, `top_k`, …).
- **QA automation (same process; configure `LLM_PROVIDER` + OpenAI or Ollama):**
  - `POST /v1/requirements/generate` — structured requirements from a topic + optional constraints.
  - `POST /v1/traceability/analyze` — requirement ↔ artifact link analysis (JSON in/out).
  - `POST /v1/traceability/generate` — suggested trace links + rationale.
  - `POST /v1/test_cases/generate` — test cases from context (+ optional requirement refs).
  - `POST /v1/test_data/generate` — labeled test payloads from a scenario (+ optional schema text).
  - `POST /v1/test_script/generate` — two-phase Selenium / Playwright / Robot script generation (merged Test_Automator).
  - `POST /v1/test_script/regenerate` — refine script with feedback; optional `session_id` for multi-turn.

These routes share optional **`INTERNAL_API_KEY`** (header `X-Internal-Key`) and in-process **`RATE_LIMIT_PER_MINUTE`** (per client IP; set `0` to disable). Test-script sessions use **`TEST_SCRIPTS_SESSION_*`** (see `.env.example`).

- `POST /internal/documents/indexed` — optional webhook after a document reaches `INDEXED` (see trigger strategy below).

## Triggers (upload → AI engine)

| Mechanism | When to use |
|-----------|-------------|
| **HTTP** (`/internal/documents/indexed`) | Simplest: `general_management` POSTs after Mongo chunks + MySQL `INDEXED`. No broker. Good for single-node and docker-compose. |
| **RabbitMQ** (`ai_rag_document_indexed` queue) | Best for scale / retries / worker pools; GM publishes JSON `{ event, project_id, project_document_id, … }`. Run `python -m worker.document_events_consumer` (or your own worker). |

**RAG queries** are always synchronous from the UI → call **HTTP** to this service (`POST /v1/rag/search`) via `AI_ENGINE_URL` from `general_management`. Do not route interactive search through RabbitMQ.

## Environment

See `.env.example`. `MONGODB_URI` must point at the same MongoDB database used by `general_management` (collection `project_document_chunks`). MySQL credentials must read the `project_document` table to list `INDEXED` rows.

**General management (Node):** Set **`AI_ENGINE_URL`** to this service’s base URL (e.g. `http://127.0.0.1:8099`) in `apis/general_management/.env` — see `apis/general_management/.env.example`. If it is unset or wrong, the UI document chat shows excerpts only and never reaches Ollama/OpenAI.

**LLM:** Set `LLM_PROVIDER=openai` with `OPENAI_API_KEY` and `OPENAI_BASE_URL` (or optional `OPENAI_BASE_URL` for Azure/OpenAI-compatible gateways), **or** set `AZURE_KEY_VAULT_URL` to load `openai-key` and `openai-endpoint` from Azure Key Vault (uses `DefaultAzureCredential`). Process env `OPENAI_API_KEY` / `OPENAI_BASE_URL` override vault values for local dev. **Or** `LLM_PROVIDER=ollama` with `OLLAMA_BASE_URL` and `OLLAMA_MODEL` (e.g. `mistral:latest`) for local or internal Ollama servers.

**Slow regeneration / “Ollama unreachable”:** Large regenerations can exceed the default LLM HTTP timeout (480s) or drop the TCP connection; timeouts are reported separately from unreachable errors. Raise **`LLM_HTTP_TIMEOUT_SECONDS`** in `ai_engine` and keep **`AI_ENGINE_LLMS_TIMEOUT_MS`** in `general_management` greater (defaults: 480s vs 600000 ms). To debug a LAN Ollama host, run `curl http://YOUR_OLLAMA_HOST:11434/api/tags` from the **machine running `ai_engine`**. Connection refused usually means Ollama is bound to loopback (`OLLAMA_HOST=0.0.0.0` on the Ollama side) or the firewall blocks port **11434**.
