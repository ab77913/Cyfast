# Logger Service — architecture

**Path:** `apis/logger_service/`  
**Runtime:** Node.js, **Fastify** (controllers use `helpers/express-compat.js` for `req` / `res` compatibility).  
**Role:** Central logging API: application, activity, audit, console, and execution logs; persists to a **document or search store** and optionally ingests **live console messages** from RabbitMQ.

## Stack

- **HTTP:** Fastify with `@fastify/cors`, `@fastify/formbody`, `@fastify/multipart`, and JSON body limits from `config.max_post_size_bytes`.
- **Persistence:** **MongoDB** (Mongoose) or **Elasticsearch** — selected by `DATABASE_TYPE_SECONDARY` (primary may be null; secondary defaults to **elasticsearch** in `config.js`).
- **Messaging:** **RabbitMQ** — `messaging/rabbitmq/listenerConsoleLog.js` subscribes to exchange **`console_log_exchange`** (same name used by test agents when publishing console output).

## Startup sequence (`index.js`)

1. Connect to the configured secondary database (MongoDB or Elasticsearch). Unsupported type exits the process.
2. If `MESSAGING_TYPE=rabbitmq`, build AMQP URL from `config/messaging.json` and start the console log listener.
3. Mount REST routes under `/logs` and listen on `config.port`.

## HTTP route map

| Mount path | Purpose |
|------------|---------|
| `/logs` | Root / health (`routes/mainRoutes`) |
| `/logs/application` | Application log CRUD or append (`applicationLogRoutes`) |
| `/logs/activity` | Activity logs |
| `/logs/audit` | Audit logs |
| `/logs/console` | Console logs (REST; complements MQ ingestion) |
| `/logs/execution` | Execution logs and uploads (multipart / archives as implemented in controllers) |

Controllers live under `controllers/`; persistence goes through models and helpers aligned with the active `db_type_secondary`.

## Storage

- **`config/storage.json`:** Per-environment `dir_path`; overridable with **`STORAGE_DIR_PATH`** for large binaries or uploaded execution bundles (`config.storage_dir_path`).

## Integrations

- **Test agent** posts to paths such as `/logs/activity`, `/logs/application`, and **`/logs/execution/upload`** (see `test_agent/architecture.md`).
- **General / report** services may reference `logger_api_url` in their app config to forward or link logs.

## Packaging

`package.json` includes **`pkg`** metadata to build a **Windows node18** binary with bundled assets — useful for on-prem log collectors.
