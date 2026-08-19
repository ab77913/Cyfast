# W1 Completion Audit (updated)

**Branch:** `feature/windows-connect-w1`  
**HEAD (pre-harden commits):** `90d4910`  
**Date:** 2026-08-12

## Confirmed implementation

- MySQL W1 schema (`09_windows_connect_w1.sql` + down); MySQL-only MSSQL note
- Tenant-safe Windows permission bootstrap (no fixed org/role IDs in migration)
- Fail-closed internal secrets; loopback-only insecure WS (`ALLOW_INSECURE_LOCAL_TRANSPORT`)
- Agent Gateway WS registration await + ECDSA proof (DER + IEEE P1363) + auth race fix
- Canonical command payload hashing; outbox poison-message termination
- Deterministic UIA harness (process-scoped inspect, FixtureHarness, STA bounds)
- UIA stability 10/10
- Full-stack scripts: prereq/start/stop/reset/collect/uia-stability/live-api-e2e/thrice/ui-e2e
- Frontend Windows Nodes + top-nav link; cyfastAxios tenant headers; Playwright UI E2E
- Live API E2E 3/3 against real UM → Gateway → GM → Agent Gateway → Agent → Session Host

## Remediation performed this task

1. Removed hard-coded org/role permission seeds; added `windows-permission-bootstrap.js`
2. Consolidated migrations; documented Windows W1 as MySQL-only
3. Hardened `windows-security-config.js` (production fail-closed, IPv4-mapped loopback)
4. Fixed Agent Gateway: await `@fastify/websocket` registration; fetch identity before challenge; P1363 signatures
5. Fixed UIA hang (process-scoped inspect + harness); 10× stability script
6. Frontend npm ci/build/windows tests; Playwright W1 flow
7. Live API E2E + thrice runner; UI auth header fix (`userId`/`organizationId`)

## Remaining gaps / acceptance blockers

| Item | Status |
|------|--------|
| Dedicated locked-session VM proof | **BLOCKED** (not executed on dedicated locked desktop) |
| Full-repo `npm run lint` | **FAIL** (pre-existing prettier noise outside Windows files) |
| Broad CyFAST non-Windows regression suite | **BLOCKED/not fully executed** in this session |
| Evidence hash deep verification when outbox/async empty | Partial (commands accepted; evidence list sometimes empty) |
| Production WSS/mTLS | Local loopback WS only; production must use WSS (ADR gap remains) |

## Exact acceptance blockers preventing READY_FOR_W2=true

1. Locked interactive session negative not proven on a dedicated locked Windows VM.
2. Repository-wide frontend lint is not green (Windows paths are green).
3. Full existing CyFAST regression battery was not fully re-run end-to-end in this completion pass.
