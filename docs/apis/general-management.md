# General Management API

**Base URL:** configured `config.url` (default local port **8088**).  
**Mount:** routes are registered at the paths in the first column (no global API prefix). Gen AI routes (documents, generation jobs, validation) are listed in the sections below; see [architecture-ai-generation.md](../architecture-ai-generation.md) for flows and configuration.

## OpenAPI / Swagger

- **UI:** `{baseUrl}/api-docs` (e.g. `http://localhost:8088/api-docs`).
- **Spec (JSON / YAML):** `{baseUrl}/api-docs/json`, `{baseUrl}/api-docs/yaml`.
- **In repo:** `apis/general_management/swagger/openapi-spec.js`; `@fastify/swagger` and `@fastify/swagger-ui` are registered from `index.js`. Existing Express-style controllers are invoked through `helpers/express-compat.js` so request/response handling stays compatible while routing uses Fastify.

## Root

| Method | Path | Handler / notes |
|--------|------|-----------------|
| `GET` | `/` | Service label / health-style response |

## Dashboard — prefix `/dashboard`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/dashboard/kpis` | KPIs |
| `GET` | `/dashboard/details` | Details |

## Projects — prefix `/projects`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/projects` | List projects |
| `GET` | `/projects/:projectId` | Get project (`projectId` numeric) |
| `POST` | `/projects` | Create project |
| `POST` | `/projects/:projectId` | Update project |
| `DELETE` | `/projects/:projectId` | Delete project |
| `GET` | `/projects/:projectId/summary` | Project summary |
| `GET` | `/projects/:projectId/test_agents` | Test agents for project |
| `POST` | `/projects/:projectId/test_agents` | Update project test agents |
| `DELETE` | `/projects/:projectId/test_agents/:testAgentId` | Detach test agent |
| `GET` | `/projects/:projectId/configuration` | Get configuration |
| `POST` | `/projects/:projectId/configuration` | Update configuration |
| `DELETE` | `/projects/:projectId/configuration` | Delete configuration |
| `GET` | `/projects/:projectId/executions` | Executions |
| `GET` | `/projects/:projectId/executions/top_failures` | Top failures |
| `GET` | `/projects/:projectId/executions/statistics` | Execution statistics |
| `GET` | `/projects/:projectId/executions/statistics/requirement_wise` | Requirement-wise stats |
| `GET` | `/projects/:projectId/executions/total_duration` | Total duration |
| `GET` | `/projects/:projectId/executions/latest` | Latest executions |

## Orchestrations — prefix `/orchestrations`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/orchestrations` | List orchestrations |
| `GET` | `/orchestrations/:orchestrationId` | Get orchestration |
| `POST` | `/orchestrations` | Create |
| `POST` | `/orchestrations/:orchestrationId` | Update |
| `DELETE` | `/orchestrations/:orchestrationId` | Delete |
| `GET` | `/orchestrations/:orchestrationId/test_cases` | Test cases |
| `GET` | `/orchestrations/:orchestrationId/test_cases/executions` | Test case executions |
| `POST` | `/orchestrations/:orchestrationId/test_cases` | Update test cases |
| `GET` | `/orchestrations/:orchestrationId/configurations` | List configurations |
| `POST` | `/orchestrations/:orchestrationId/configurations` | Add configuration |
| `POST` | `/orchestrations/:orchestrationId/configurations/:projectConfigurationId` | Update configuration |
| `DELETE` | `/orchestrations/:orchestrationId/configurations` | Delete configurations |
| `GET` | `/orchestrations/:orchestrationId/executions` | Executions |
| `GET` | `/orchestrations/:orchestrationId/executions/latest` | Latest execution |
| `GET` | `/orchestrations/:orchestrationId/executions/statistics` | Execution statistics |
| `GET` | `/orchestrations/:orchestrationId/executions/trends` | Execution trends |
| `POST` | `/orchestrations/:orchestrationId/start_execution` | Start execution |
| `POST` | `/orchestrations/:orchestrationId/pause_execution` | Pause |
| `POST` | `/orchestrations/:orchestrationId/resume_execution` | Resume |
| `POST` | `/orchestrations/:orchestrationId/stop_execution` | Stop |

## Traceability — prefix `/traceability`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/traceability` | Traceability data |
| `GET` | `/traceability/end_to_end` | End-to-end |
| `GET` | `/traceability/imports` | Imports |
| `GET` | `/traceability/insights` | Insights |
| `GET` | `/traceability/statistics` | Statistics |
| `GET` | `/traceability/export` | Export |
| `POST` | `/traceability/import` | Import (multipart via file-upload middleware) |
| `POST` | `/traceability/import/resume` | Resume import |
| `POST` | `/traceability/import/discard` | Discard import |

## Requirements — prefix `/requirements`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/requirements` | List |
| `GET` | `/requirements/:requirementId` | Get |
| `POST` | `/requirements` | Create |
| `POST` | `/requirements/:requirementId` | Update |
| `DELETE` | `/requirements/:requirementId` | Delete |

## Risks — prefix `/risks`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/risks` | List |
| `GET` | `/risks/:riskId` | Get |
| `POST` | `/risks` | Create |
| `POST` | `/risks/:riskId` | Update |
| `DELETE` | `/risks/:riskId` | Delete |

## Test sources — prefix `/test_sources`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_sources` | List |
| `GET` | `/test_sources/:testSourceId` | Get |
| `POST` | `/test_sources` | Create |
| `POST` | `/test_sources/:testSourceId` | Update |
| `DELETE` | `/test_sources/:testSourceId` | Delete |
| `POST` | `/test_sources/:testSourceId/import` | Import test cases |

## Test suites — prefix `/test_suites`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_suites` | List |
| `GET` | `/test_suites/:testSuiteId` | Get |
| `POST` | `/test_suites` | Create |
| `POST` | `/test_suites/:testSuiteId` | Update |
| `DELETE` | `/test_suites/:testSuiteId` | Delete |

## Test scripts — prefix `/test_scripts`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_scripts` | List |
| `GET` | `/test_scripts/:testScriptId` | Get |
| `POST` | `/test_scripts` | Create |
| `POST` | `/test_scripts/:testScriptId` | Update |
| `DELETE` | `/test_scripts/:testScriptId` | Delete |

## Test cases — prefix `/test_cases`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_cases` | List |
| `GET` | `/test_cases/:testCaseId` | Get |
| `POST` | `/test_cases` | Create |
| `POST` | `/test_cases/:testCaseId` | Update |
| `DELETE` | `/test_cases/:testCaseId` | Delete |
| `POST` | `/test_cases/:testCaseId/start_execution` | Start execution |

## Test agents — prefix `/test_agents`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_agents` | List |
| `GET` | `/test_agents/:testAgentId` | Get |
| `POST` | `/test_agents/:testAgentId/stop` | Stop agent |
| `POST` | `/test_agents/:testAgentId/projects` | Map projects |
| `DELETE` | `/test_agents/:testAgentId` | Delete |

## Project documents — prefix `/project_documents`

Ingestion and RAG (see [architecture-ai-generation.md](../architecture-ai-generation.md)).

| Method | Path | Handler / notes |
|--------|------|-----------------|
| `GET` | `/project_documents` | List (query: filters, sort, page, size) |
| `GET` | `/project_documents/doc_types` | Allowed `doc_type` catalog |
| `POST` | `/project_documents/upload` | **Multipart** — fields: `project_id` (required), `file`, optional metadata (`doc_type`, `title`, `organization_id`, …); header `x-user-id` |
| `POST` | `/project_documents/search` | RAG search JSON body |
| `POST` | `/project_documents/chat` | RAG chat JSON body |
| `GET` | `/project_documents/:id` | Get one |
| `GET` | `/project_documents/:id/download` | Redirect to storage URL |
| `POST` | `/project_documents/:id/reparse` | Re-parse (202, async) |
| `DELETE` | `/project_documents/:id` | Delete; query `hard_delete` |

## Requirement generation — prefix `/requirement_generation`

Async jobs unless noted. `POST /jobs` returns **202** when queued.

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/requirement_generation/jobs` | Create job (`project_id`, `organization_id`, `document_ids[]`, `requirement_categories[]`, optional `additional_instructions`) |
| `GET` | `/requirement_generation/jobs` | List jobs (`project_id` required) |
| `GET` | `/requirement_generation/jobs/:jobId` | Job status + candidates |
| `POST` | `/requirement_generation/jobs/:jobId/regenerate` | Regenerate job |
| `GET` | `/requirement_generation/pending` | Pending drafts for project |
| `POST` | `/requirement_generation/candidates/:candidateId/approve` | Promote to `requirement` |
| `POST` | `/requirement_generation/candidates/:candidateId/reject` | Reject draft |
| `POST` | `/requirement_generation/candidates/bulk_approve` | Bulk approve |
| `POST` | `/requirement_generation/candidates/bulk_reject` | Bulk reject |
| `POST` | `/requirement_generation/candidates/bulk_discard` | Bulk discard |
| `POST` | `/requirement_generation/candidates/regenerate` | Regenerate selected with feedback |
| `POST` | `/requirement_generation/jobs/bulk_regenerate` | Bulk job regenerate |
| `POST` | `/requirement_generation/jobs/discard_pending` | Discard pending for jobs |

## Test scenario generation — prefix `/test_scenario_generation`

Same job/approval pattern as requirement generation.

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/test_scenario_generation/jobs` | Create job (`project_id`, `organization_id`, `all_approved` or `requirement_ids[]`, `scenario_types[]`, optional `safety_options`, `additional_instructions`) |
| `GET` | `/test_scenario_generation/jobs` | List (`project_id` required) |
| `GET` | `/test_scenario_generation/jobs/:jobId` | Get job |
| `POST` | `/test_scenario_generation/jobs/:jobId/regenerate` | Regenerate |
| `GET` | `/test_scenario_generation/pending` | Pending drafts |
| `POST` | `/test_scenario_generation/candidates/:candidateId/approve` | Promote to `test_scenario` |
| `POST` | `/test_scenario_generation/candidates/:candidateId/reject` | Reject |
| `POST` | `/test_scenario_generation/candidates/bulk_approve` | Bulk approve |
| `POST` | `/test_scenario_generation/candidates/bulk_reject` | Bulk reject |
| `POST` | `/test_scenario_generation/candidates/bulk_discard` | Bulk discard |
| `POST` | `/test_scenario_generation/candidates/regenerate` | Regenerate selected |
| `POST` | `/test_scenario_generation/jobs/bulk_regenerate` | Bulk regenerate jobs |
| `POST` | `/test_scenario_generation/jobs/discard_pending` | Discard pending |

## Test scenarios (approved) — prefix `/test_scenarios`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/test_scenarios` | List (project filters via query) |
| `GET` | `/test_scenarios/:testScenarioId` | Get one |

## Generation validation — prefix `/generation_validation`

Synchronous; proxies to AI Engine when `AI_ENGINE_URL` is set.

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/generation_validation/requirements` | Validate requirement drafts |
| `POST` | `/generation_validation/test_cases` | Validate test-case drafts |
| `POST` | `/generation_validation/other` | Custom checklist validation |

## User notifications — prefix `/user_notifications`

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/user_notifications/me` | List for current user (`x-user-id` or auth integration) |
| `POST` | `/user_notifications/me/read_all` | Mark all read |
| `POST` | `/user_notifications/:notificationId/read` | Mark one read |

## Source files

`apis/general_management/routes/*.js`, mounted in `apis/general_management/index.js`.
