# Logger Service API

**Base URL:** configured `config.url` (default local port **8090**).  
All routes below are under the **`/logs`** prefix unless noted.

## OpenAPI / Swagger

- **UI:** `{baseUrl}/api-docs` (e.g. `http://localhost:8090/api-docs`).
- **Spec (JSON / YAML):** `{baseUrl}/api-docs/json`, `{baseUrl}/api-docs/yaml`.
- **In repo:** `apis/logger_service/swagger/openapi-spec.js`; plugins registered from `index.js`. Execution log uploads use `middlewares/fastify-execution-log-upload.js`. Controllers run via `helpers/express-compat.js`.

## Main — mount `/logs`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs` | Service root |

## Application logs — mount `/logs/application`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs/application` | List / query |
| `POST` | `/logs/application` | Create |
| `GET` | `/logs/application/:id` | Get by id |

## Activity logs — mount `/logs/activity`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs/activity` | List |
| `POST` | `/logs/activity` | Create |
| `GET` | `/logs/activity/:id` | Get |

## Audit logs — mount `/logs/audit`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs/audit` | List |
| `POST` | `/logs/audit` | Create |
| `GET` | `/logs/audit/:id` | Get |

## Console logs — mount `/logs/console`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs/console` | List |
| `POST` | `/logs/console` | Create |
| `POST` | `/logs/console/publish` | Publish |
| `GET` | `/logs/console/:id` | Get |

## Execution logs — mount `/logs/execution`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/logs/execution` | List |
| `POST` | `/logs/execution` | Create |
| `GET` | `/logs/execution/orchestration_execution/:execution_id/reports/download/all` | Download all reports |
| `GET` | `/logs/execution/orchestration_execution/:execution_id/reports/:report_file` | Single report file |
| `GET` | `/logs/execution/orchestration_execution/:execution_id` | Logs for execution |
| `POST` | `/logs/execution/upload` | Upload (multipart) |
| `GET` | `/logs/execution/:id` | Get execution log by id |

## Source files

`apis/logger_service/index.js`, `apis/logger_service/routes/*.js`.
