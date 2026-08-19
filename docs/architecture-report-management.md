# Report Management API — architecture

**Path:** `apis/report_management/`  
**Runtime:** Node.js, **Fastify** (controllers use `helpers/express-compat.js` for `req` / `res` compatibility).  
**Role:** Report design and generation: design templates, report sections, report templates, and assembled reports (HTML, PDF, Word, console log handling, dataset mapping). Uses the **logger API URL** from config when integrating with centralized logging.

## Stack

- **HTTP:** Fastify with `@fastify/cors`, `@fastify/formbody`, `@fastify/multipart`, and JSON body limits from `config.max_post_size_bytes`.
- **Primary data:** Sequelize — **MySQL** or **MSSQL** under `database/mysql/` or `database/mssql/` (projects, orchestrations, executions, traceability, etc., depending on factories used by services).
- **Secondary data:** **MongoDB** (Mongoose) or **Elasticsearch** — stores design templates, report sections, and report template documents; factories are chosen with `config.db_type_secondary`.
- **Messaging:** RabbitMQ consumer/producer code exists in the tree but is **commented out** in `index.js` (optional future use for console-log download queues).

## Startup sequence (`index.js`)

1. Connect secondary store (MongoDB or Elasticsearch).
2. If secondary is **Elasticsearch**, after a short delay **`services/boot-service`** runs **`setupDefault()`** to seed default report templates (console log, orchestration execution log, orchestration test summary, project test summary) from **`storage/`** defaults when missing.
3. Mount routes and listen on `config.port`.

## HTTP route map

| Mount path | Module | Concern |
|------------|--------|---------|
| `/` | `routes/mainRoutes` → `main-routes.js` | Service health / name (`index.js` uses `./routes/mainRoutes`) |
| `/design_templates` | `routes/designTemplateRoutes` | Design templates |
| `/report_sections` | `routes/reportSectionRoutes` | Reusable sections |
| `/report_templates` | `routes/reportTemplateRoutes` | Template composition |
| `/reports` | `routes/reportRoutes` | Report generation and retrieval |

## Service layer

| Service | Responsibility |
|---------|----------------|
| `services/boot-service.js` | Idempotent default template setup in the secondary store. |
| `services/report-service.js` | Core report orchestration. |
| `services/html-service.js` | HTML rendering/transforms. |
| `services/pdf-service.js` | PDF output (e.g. headless / HTML-to-PDF pipeline). |
| `services/word-service.js` | DOCX generation (templating). |
| `services/dataset-service.js` | Dataset extraction and mapping for reports. |
| `services/console-log-service.js` | Console log sections for reports. |
| `services/project-service.js` | Project-scoped report data access. |

## Configuration (`config.js`)

- **`DATABASE_TYPE_PRIMARY`** — default in source is **mssql** (override via env).
- **`DATABASE_TYPE_SECONDARY`** — default **elasticsearch**.
- **`loggerServiceUrl`** — from `config/app.json` per environment (`logger_api_url`).
- **`default_templates`** — maps logical template types to filenames under `storage/` (HTML/JSON defaults for sections and summaries).

## Storage defaults

Static defaults live under `apis/report_management/storage/` (HTML fragments, JSON for dataset mappings and sections). Boot service copies or registers these into the document store when appropriate.
