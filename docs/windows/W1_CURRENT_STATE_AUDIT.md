# W1 Current State Audit

**Branch audited:** `feature/rag-chatbot` → implementing on `feature/windows-connect-w1`  
**Date:** 2026-08-12  
**Git HEAD at audit:** `6be343e` (Merged PR 1951)

## Commands recorded

```
git status          # clean working tree on feature/rag-chatbot
git branch --show-current  # feature/rag-chatbot
git branch -a       # master, feature/*, recovery/windows-runtime-baseline (same tip as HEAD)
git log --oneline --decorate -30
```

`recovery/windows-runtime-baseline` and `feature/test_script_automation` resolve to the **same commit** as `feature/rag-chatbot`. They contain **no Windows runtime / WinAppDriver / FlaUI / UIAutomation / Agent Gateway** code.

## What already exists

| Area | Status |
|------|--------|
| CyFAST pipeline (docs → requirements → scenarios → cases → scripts → suites → orchestrations → agents → executions → results) | Present |
| API Gateway (Fastify proxy) | Present — no auth, proxies GM/UM/logger/storage |
| General Management (Fastify + Sequelize MySQL) | Present |
| User Management (JWT, roles; permission tables empty of seed rows) | Present |
| Storage Service (multipart upload + **public** `/files` static) | Present — insecure for evidence |
| Logger / audit log APIs | Present |
| RabbitMQ producers/listeners for test agents & AI jobs | Present |
| Python `test_agent` (Robot/Pytest/SpecFlow/CAPL) connecting **directly to RabbitMQ** | Present — **not** suitable for W1 Windows Connect |
| React UI (`ui/`) with projects, inventory, test-agents, admin | Present — no Windows Nodes |
| MySQL schema scripts `01`–`08` under `databases/MYSQL/cyfast2/2.0.0/` | Present (next = `09`) |
| SpecFlow plugin (.NET test runner via agent) | Present — not desktop UIA |
| CAPL plugin (Windows/CANoe) | Present — **out of scope for W1**; leave untouched |
| gRPC / Appium / WinAppDriver / FlaUI / HMS | **Absent** |
| Feature-flag infrastructure | **Absent** |
| Automated Jest/Mocha/pytest suites for APIs/UI | **Absent** (package scripts are placeholders) |

## What can be reused

- Fastify route/controller/factory patterns in General Management
- Sequelize MySQL model conventions (`organization_id`, audit/soft-delete columns, `{entity}_id` PKs)
- SQL incremental migration style (`09_*.sql`)
- RabbitMQ `mq-producer.js` + messaging.json naming (extend with Windows events; agents still must **not** consume RabbitMQ)
- Storage Service upload API (extend with **authenticated evidence download** + content hash; do not copy public static URLs for evidence)
- UI AuthGuard, axios clients, menu/routes layout
- Existing JWT auth middleware files (currently unused on most routes) — wire Windows APIs with permission checks
- Test agent **concept** (registration, heartbeat, status) as UX/domain precedent — **not** the RabbitMQ transport

## What is missing (W1 must add)

- Agent Gateway with outbound agent transport
- Windows Agent Service + Interactive Session Host + named-pipe IPC
- UI Automation inspector (UIA3)
- Deterministic Windows test fixture app
- Enrollment tokens / agent identity / certificates
- Windows nodes, sessions, application profiles, commands, evidence entities
- Feature flag `WINDOWS_AUTOMATION_ENABLED`
- Protected evidence access
- Frontend Windows Nodes + session inspector UI
- Scripts, docs, unit/integration/UIA/E2E tests

## What is unsafe (must not copy)

| Finding | Risk | W1 response |
|---------|------|-------------|
| Storage public `/files` | Evidence leakage | Protected evidence routes + authz; no public evidence folder |
| Test agent hard-coded `organization_id: 1` in registration path | Tenant break | Never reuse; enrollment always carries org from token |
| CORS `origin: "*"` on GM/Storage | Over-broad | Do not expand; Windows evidence must not rely on public CORS |
| Production RabbitMQ host IP in messaging.json | Hard-coded infra | Do not add new hard-coded IPs; Windows agent never uses RabbitMQ |
| Empty permission catalog / unused authorize middleware | Authz theater | Seed Windows permissions; enforce on Windows APIs |
| Direct RabbitMQ agent pattern | Violates W1 trust boundary | Agent Gateway only |

## What will be changed in W1

- New MySQL script `09_windows_connect_w1.sql` (+ MSSQL mirror where practical)
- New Sequelize models/factories/services/controllers/routes under GM
- New `apis/agent_gateway` service
- New `windows/` .NET solution (net9.0 — SDK 10 not installed on build host)
- New Storage evidence-protect endpoints
- New RabbitMQ Windows event names + outbox for command reliability
- New UI routes under Resources → Windows Nodes (feature-flagged)
- New docs under `docs/windows/`, scripts under `scripts/windows/`
- New test projects and `run-w1-e2e.ps1`

## What will not be changed in W1

- Existing auth login flows (extended only with new permissions)
- Projects / requirements / scenarios / cases / scripts / suites / orchestrations
- Existing Python test agent RabbitMQ execution path
- Android, embedded, CANoe, UART/SPI/I2C/BT/Wi-Fi/CAN/LIN/TRDP
- Linux/macOS/iOS desktop agents
- Live WebRTC desktop video, full recorder, AI healing, VM provisioning
- Appium Windows / WinAppDriver as primary (adapter stubs only)
- Public signed MSI / auto-updater

## Compatibility impact

- Default: `WINDOWS_AUTOMATION_ENABLED=false` → existing APIs and UI behave as today
- New tables are additive; no destructive alters of core pipeline tables
- Gateway gains optional upstream for agent_gateway (non-breaking)
- Storage gains new authenticated routes; existing `/files` left for legacy (not used for Windows evidence)

## Rollback approach

1. Set `WINDOWS_AUTOMATION_ENABLED=false` and stop Agent Gateway / Windows Agent service
2. Remove UI menu/routes behind the flag (no-op when disabled)
3. Drop W1 tables via documented `09_windows_connect_w1_down.sql`
4. Revert branch commits or undeploy new packages
5. Existing CyFAST pipeline continues without Windows Connect

## Reuse decision for historical Windows branches

`recovery/windows-runtime-baseline` has **no distinct Windows implementation** at current tip. Nothing to port. W1 is greenfield aligned to repository conventions.
