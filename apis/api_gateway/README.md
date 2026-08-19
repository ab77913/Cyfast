# CyFAST API gateway

Single HTTP entry that proxies to all backend services under `apis/`.

## Listen port (80 or 8080)

- Default in `config/app.json` (**local** / **development** / **staging** / **production**): **8080** on `0.0.0.0`.
- Override with **`GATEWAY_PORT`** or standard **`PORT`** (e.g. `PORT=80` or `GATEWAY_PORT=80`). Binding to **80** may require elevated privileges on Linux/macOS.

## Path map

| Gateway path | Backend |
|--------------|---------|
| `/services/general-management/*` | General Management (default `http://127.0.0.1:8088`) |
| `/services/report-management/*` | Report Management (`…:8089`) |
| `/services/user-management/*` | User Management (`…:8087`) |
| `/services/logger/*` | Logger Service (`…:8090`) — e.g. `/services/logger/logs/...` |
| `/services/storage/*` | Storage Service (`…:8092`) |

The gateway **strips** the `/services/<name>` prefix when forwarding (see `@fastify/http-proxy`).

Example: `GET http://localhost:8080/services/general-management/projects` → `GET http://127.0.0.1:8088/projects`.

## Upstream overrides

Set any of:

- `UPSTREAM_GENERAL_MANAGEMENT`
- `UPSTREAM_REPORT_MANAGEMENT`
- `UPSTREAM_USER_MANAGEMENT`
- `UPSTREAM_LOGGER_SERVICE`
- `UPSTREAM_STORAGE_SERVICE`

to a full base URL (no trailing slash), e.g. `http://general-api:8088`.

## Run

```bash
cd apis/api_gateway
npm install
npm start
```

Optional: `GATEWAY_HOST`, `GATEWAY_PROTOCOL` (used only for the root JSON `publicUrl` hint).
