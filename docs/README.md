# CyFast2 documentation

Architecture references for each runnable component in this repository.

## HTTP API reference

Route-level documentation for all backend HTTP services: **[`apis/`](apis/README.md)** (including **OpenAPI / Swagger** URLs and spec file locations).

| Document | Component | Location in repo |
|----------|-----------|----------------|
| [System overview](architecture-overview.md) | How services fit together | — |
| [AI-assisted generation](architecture-ai-generation.md) | Document ingestion, RAG, requirement & test scenario jobs, validation | `ai_engine/`, `apis/general_management/` |
| [General Management API](architecture-general-management.md) | Projects, orchestrations, tests, traceability, agents | `apis/general_management/` |
| [Report Management API](architecture-report-management.md) | Report templates, sections, generation | `apis/report_management/` |
| [User Management API](architecture-user-management.md) | Auth, users, roles, permissions | `apis/user_management/` |
| [Logger Service](architecture-logger-service.md) | Application, activity, audit, console, execution logs | `apis/logger_service/` |
| [Storage Service](architecture-storage-service.md) | File upload, static serving, metadata in MongoDB | `apis/storage_service/` |
| [Test Agent](architecture-test-agent.md) | Python test execution worker | `test_agent/` |
| [Web UI](architecture-ui.md) | React dashboard | `ui/` |

HTTP route tables for backend services (including new Gen AI mounts on General Management): **[`apis/`](apis/README.md)**. The AI Engine is documented separately at [`apis/ai-engine.md`](apis/ai-engine.md) because it is not behind the API gateway.

For the test agent, the repository also contains a detailed technical spec at `test_agent/architecture.md` (messaging, payload shapes, plugins).
