# CyFast2 — HTTP API reference

This folder lists **REST-style HTTP endpoints** as implemented in each service’s route modules. It is generated from the repository layout (mount prefixes in each service’s entry `index.js` plus paths in `routes/`). For system behavior and data stores, see `docs/architecture-*.md`.

## Services and default ports (`local`)

| Service | Base path prefix | Default port | Source |
|---------|------------------|--------------|--------|
| [General Management](general-management.md) | `/` (resource paths below) | `8088` | `apis/general_management/` |
| [Report Management](report-management.md) | `/design_templates`, `/report_sections`, `/report_templates`, `/reports` | `8089` | `apis/report_management/` |
| [User Management](user-management.md) | `/`, `/auth`, `/users`, `/roles`, `/permissions` | `8087` | `apis/user_management/` |
| [Logger Service](logger-service.md) | `/logs`, `/logs/...` | `8090` | `apis/logger_service/` |
| [Storage Service](storage-service.md) | `/`, `/files/...` | `8092` | `apis/storage_service/` |
| [AI Engine](ai-engine.md) | `/v1/...` (RAG, generation, validation) | `8099` | `ai_engine/` — called by GM, not in gateway |
| **API Gateway** (reverse proxy) | `/services/general-management`, `/services/report-management`, `/services/user-management`, `/services/logger`, `/services/storage` | **`8080`** (or **`80`** via `PORT` / `GATEWAY_PORT`) | `apis/api_gateway/` |

Ports and hosts come from each service’s `config/` or `configs/` `app.json` and can be overridden with environment variables where supported. The gateway listens on **`GATEWAY_PORT`**, then **`PORT`**, then `apis/api_gateway/config/app.json` for the active `NODE_ENV`; set upstreams with **`UPSTREAM_<KEY>`** (see `apis/api_gateway/README.md`). Path prefixes are stripped when forwarding, so a service route like `GET /projects` is reached as `GET {gateway}/services/general-management/projects`.

## OpenAPI (Swagger)

Every HTTP API in this table exposes **interactive Swagger UI** and a machine-readable **OpenAPI 3** description.

| Service | Swagger UI | OpenAPI document |
|---------|------------|------------------|
| General Management, Report Management, Logger | `{baseUrl}/api-docs` | `{baseUrl}/api-docs/json` and `{baseUrl}/api-docs/yaml` |
| User Management, Storage (Fastify) | `{baseUrl}/api-docs` | `{baseUrl}/api-docs/json` and `{baseUrl}/api-docs/yaml` |
| AI Engine (FastAPI) | `{baseUrl}/docs` | OpenAPI JSON at `/openapi.json` |

Replace `{baseUrl}` with the service’s configured URL (for example `http://localhost:8088`), or the same path under the API gateway (for example `http://localhost:8080/services/general-management` for General Management). Specs are maintained in each repo under `apis/<service>/swagger/` (`openapi-spec.js` for General Management, Report Management, and Logger; `openapi-config.js` for User Management and Storage). Request/response schemas are intentionally loose in places (generic `object` bodies); tighten them in those files as contracts stabilize.

## Conventions

- **JSON** bodies and responses are typical unless a route specifies **multipart** (file upload).
- **Path parameters:** URLs follow the route modules in each service (e.g. `/projects/:projectId/...`). Treat numeric segments as ids even when the path pattern is written with constraints in legacy comments.
- **Authentication:** User Management issues JWTs on login (`accessToken` / `refreshToken` in JSON). Other APIs may expect `Authorization: Bearer <token>` depending on deployment; General Management ships `middlewares/auth.js` but it is **not** wired globally in `index.js`—confirm at integration time.
- **CORS** is broadly open (`*`) in several services; tighten for production.

## Gen AI routes

Requirement generation, test scenario generation, document ingestion, and validation are mounted on **General Management** (see [general-management.md](general-management.md)). End-to-end behavior: [AI-assisted generation — architecture](../architecture-ai-generation.md).

## Related

- [Documentation index](../README.md)
- [Architecture overview](../architecture-overview.md)
- [AI-assisted generation](../architecture-ai-generation.md)
