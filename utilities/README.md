# CyFast service utilities

Scripts to start or stop CyFAST **locally on the host** (Node + Python). Docker for databases is **opt-in**.

## Defaults

- **Repo root:** parent of `utilities/`.
- **Node APIs** (`npm start`): user_management **8087**, general_management **8088**, logger **8090**, storage **8092**, gateway **8080**, UI (Vite) **5173**. **`report_management` is omitted** from start scripts and from `api_gateway` routes for now.
- **AI engine:** started by default using **`ai_engine/.venv`** (`python -m uvicorn … :8099`). If there is no venv, the script prints a warning and skips AI. Set **`SKIP_AI_ENGINE=1`** to skip.
- **Docker:** **not** used unless you set **`CYFAST_USE_DOCKER=1`** (then `databases/docker-compose.yml` + `cyfastnet` as before).

## Scripts
| File | Purpose |
|------|---------|
| `start-services.bat` | Windows: consoles per service |
| `stop-services.bat` | Windows: free CyFast ports (PowerShell) |
| `start-services.sh` | macOS/Linux: background + logs in `utilities/logs/` |
| `stop-services.sh` | UNIX: PIDs file + ports |

## Environment overrides

| Variable | Effect |
|---------|--------|
| `CYFAST_USE_DOCKER=1` | Run `docker compose` for `databases/docker-compose.yml` |
| `SKIP_AI_ENGINE=1` | Do not start `ai_engine` |
| `NODE_ENV` | Passed through to Node |

## Prerequisites

- **Node.js** / **npm** on PATH for APIs + UI.
- **`ai_engine/.venv`** with dependencies installed (**required** for AI to start; see `ai_engine/README.md`).
- Your own **local** MySQL / Mongo / RabbitMQ / Elasticsearch as configured in each service’s env — unless you use `CYFAST_USE_DOCKER=1`.

## Stopping processes

Stop scripts free **8080, 8087, 8088, 8090, 8092, 8098, 8099, 5173** (not Docker DB ports).

`stop-services.sh` also reads `utilities/logs/start-all.pids`.

Unix: `chmod +x utilities/start-services.sh utilities/stop-services.sh`
