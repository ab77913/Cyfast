# General Management API — architecture

**Path:** `apis/general_management/`  
**Runtime:** Node.js, **Fastify** (existing controllers are still written for Express-style `req` / `res`; see `helpers/express-compat.js`).  
**Role:** Primary orchestration and project API for CyFAST: projects, requirements, risks, traceability, test artifacts, orchestrations, test agents, dashboards; **Gen AI V&V** (documents, generation jobs, validation proxies); integration with **RabbitMQ**, **Storage Service**, and the **AI Engine** (`AI_ENGINE_URL`).

**Gen AI behavior (ingestion, RAG, jobs, validation):** [AI-assisted generation](architecture-ai-generation.md). **HTTP paths:** [General Management API](apis/general-management.md).

## Stack

- **HTTP:** Fastify with `@fastify/cors`, `@fastify/formbody`, `@fastify/multipart`, and a custom JSON parser sized from `config.max_post_size_bytes`.
- **Primary data:** Sequelize against **MySQL** or **Microsoft SQL Server** (`config.db_type_primary`, factories and models under `database/mysql/` or `database/mssql/`).
- **Secondary data (optional):** **MongoDB** (Mongoose) or **Elasticsearch** client when `DATABASE_TYPE_SECONDARY` is set.
- **Messaging:** **RabbitMQ** via `amqplib` when `MESSAGING_TYPE=rabbitmq`; implementation split under `messaging/rabbitmq/` (producer + listeners).

## Startup sequence (`index.js`)

1. Connect secondary database if configured (MongoDB or Elasticsearch).
2. If RabbitMQ is enabled: verify producer connection, start listeners for agent registration, heartbeats, parser responses, test case execution, orchestration status, **requirement generation**, and **test scenario generation**; start a **10s interval** calling `backgroundService.monitorTestAgents` to mark agents dead when heartbeats lapse.
3. Log whether `AI_ENGINE_URL` is set (RAG/chat and all LLM generation depend on it for full functionality).
4. Register Fastify route plugins and listen on `config.port` (host `0.0.0.0`).

## HTTP route map

| Mount path | Module | Concern |
|------------|--------|---------|
| `/` | `routes/main-routes` | Service health / name |
| `/dashboard` | `routes/dashboard-routes` | Dashboards |
| `/projects` | `routes/project-routes` | Projects and configuration |
| `/orchestrations` | `routes/orchestration-routes` | Test orchestrations |
| `/traceability` | `routes/traceability-routes` | Trace links |
| `/requirements` | `routes/requirement-routes` | Requirements (manual CRUD) |
| `/requirement_generation` | `routes/requirement-generation-routes` | AI requirement jobs & draft approval |
| `/test_scenario_generation` | `routes/test-scenario-generation-routes` | AI test scenario jobs & draft approval |
| `/test_scenarios` | `routes/test-scenario-routes` | Approved test scenarios (read) |
| `/generation_validation` | `routes/generation-validation-routes` | Proxy to ai_engine validation rubrics |
| `/project_documents` | `routes/project-document-routes` | Upload, ingest, RAG search/chat |
| `/user_notifications` | `routes/user-notification-routes` | Async job / ingestion notifications |
| `/risks` | `routes/risk-routes` | Risks |
| `/test_sources` | `routes/test-source-routes` | Test sources |
| `/test_suites` | `routes/test-suite-routes` | Test suites |
| `/test_scripts` | `routes/test-script-routes` | Test scripts |
| `/test_cases` | `routes/test-case-routes` | Test cases |
| `/test_agents` | `routes/test-agent-routes` | Agent registry and control |

Controllers delegate to **factories** and **services** (for example `services/execution-service.js`, `services/background-service.js`) to keep route handlers thin.

## Messaging (RabbitMQ)

Listeners and exchanges are driven by `configs/messaging.json` (`mq_queues`, `mq_exchanges`). Typical concerns:

- **Agent registration / heartbeat** — align agent records with messages from agents and the engine.
- **Parser responses** — consume structured parsing results from agents.
- **Test case execution** — exchange for per-test execution events.
- **Orchestration status** — queue for orchestration-level status responses.
- **Requirement / test scenario generation** — queues `requirement_generation_request`, `test_scenario_generation_request`; listeners invoke `requirement-generation-service` and `test-scenario-generation-service` (see [AI-assisted generation](architecture-ai-generation.md)).

The **MQ producer** sends commands and updates to exchanges used by the test engine, agents, and generation workers (routing keys in `configs/messaging.json`).

## Background jobs

- **`services/background-service.js`:** Loads alive agents from the primary DB; if last heartbeat is older than 10 seconds, updates status to `DEAD`.

## Configuration

- **`config.js`:** Loads `configs/database.json`, `configs/messaging.json`, `configs/app.json`; exposes `port`, `url`, DB handles, MQ URLs, `max_post_size`, default template metadata for console/orchestration HTML snippets when applicable.

## Dependencies of note

Beyond Fastify/Sequelize: **axios** (`services/ai-engine-client.js`, `storage-client.js`), **amqplib**, document parsers for ingestion, and report-related libraries (e.g. **puppeteer**, **docxtemplater**, **html-pdf-node**) where applicable.

## SQL migrations (Gen AI)

Versioned scripts under `databases/MYSQL/cyfast2/2.0.0/`: `04_project_documents.sql`, `05_requirement_generation.sql`, `06_user_notification.sql`, `07_test_scenario_generation.sql`, `07_job_additional_instructions.sql`.
