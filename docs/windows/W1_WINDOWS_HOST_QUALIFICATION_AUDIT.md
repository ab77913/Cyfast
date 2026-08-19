# W1 Windows Host Qualification Audit

Generated: 2026-08-13T19:33:00Z

## Host and repository

| Field | Actual value |
|---|---|
| Host | INBE1E-DL3639AG (domain omitted) |
| Windows | Enterprise 23H2, build 22631.7376 (Windows reports product name `Windows 10 Enterprise`) |
| Architecture | x64 / 64-bit |
| Interactive session | Console session 1, Active, unlocked during desktop gates |
| PowerShell | Windows PowerShell 5.1.22621.7376 |
| .NET SDK | 9.0.316, matching `windows/global.json` |
| Node / npm | v22.23.2 / 10.9.8 |
| Docker | Desktop 4.84.0, Engine 29.6.2, Compose 5.3.1 |
| Git | 2.55.0.windows.3 |
| Branch | `feature/windows-connect-w1` |
| Starting HEAD | `9994385772af53c2c1b676b5204128d787c5e154` (newer than the requested `dd7b6436`) |
| Qualification fix | `eb4996141a613dc3b8a3b9b518438eca4f614a48` |
| Base | `6be343e` |
| Initial tree | Dirty with pre-existing UI/report/prerequisite edits and this audit file |

Fetch and fast-forward synchronization succeeded; local and origin were identical at the starting HEAD. The W1 diff from the stated base contains 143 files, not the brief's 84-file label. No W2, Android, embedded, generated certificate, private-key, log, dump, binary, or test-result path was found in the W1 changed-file set. The full unfiltered .NET run had zero skipped tests.

## Actual execution

| Gate | Result | Actual evidence |
|---|---|---|
| Repository prerequisite equivalent | PASS | `scripts/windows/test-w1-prerequisites.ps1`, 9 checks |
| Exact stable prerequisite command | BLOCKED | Requested script absent |
| .NET restore/build/test | PASS | 0 warnings, 0 errors; 9/9 tests, 0 skipped |
| General Management | PASS | 21/21 after five qualification-harness regressions were added |
| Agent Gateway | PASS | 3/3 unit tests |
| Storage requested suite | BLOCKED | Requested test file absent |
| API Gateway requested suite | BLOCKED | Requested test file absent |
| Frontend unit/build | PASS | 5/5 tests; production build succeeded |
| Changed-files quality | PASS | Full-repository lint exit remains 1 legacy debt |
| Real UIA stability | PASS | 10/10 on console session 1, real fixture/FlaUI |
| Repository WSS harness | PASS with insufficient coverage | 3/3 limited TLS health/trust/hostname/missing-client checks; no real Agent WebSocket/ECDSA/revocation/replay proof |
| Available live API E2E | PASS with insufficient transport/polling coverage | 28 checks x 3; real Agent/Session Host/fixture/UIA/evidence, but loopback `ws://`, shared MySQL, and non-polling wait helper |
| Available frontend E2E | FAIL mandatory stability | First attempt exit 1; three later reruns exit 0; uses Vite dev server/plain `ws://`; final artifact directory empty |
| Available existing-pipeline harness | PASS with insufficient depth | 3/3, but accepts 400/404 lifecycle probes and does not prove the full execution/result chain or cleanup |
| Evidence recovery | BLOCKED | Requested script absent; outage scenarios not executed |
| Live correlation | BLOCKED | Requested script absent |
| Live secret redaction | BLOCKED | Requested script absent |
| Dedicated lab | BLOCKED | No lab env refs/provider adapter; Hyper-V services run but VM enumeration is denied by host authorization |
| Locked/disconnected session | BLOCKED | `run-w1-session-state-e2e.ps1` exit 2; development desktop was not locked |
| Corrected final runner | BLOCKED | Exit 1; 5/6 mandatory checks passed, 0 failed, 1 blocked |

## Windows defects proven and fixed

- Avoided replaying non-idempotent migrations 04-07 against the current `01_schema.sql` image; fresh startup applies 08-10.
- Replaced unsupported/unsafe PowerShell 5.1 async process launch and logging with native redirected `Start-Process`.
- Applied MongoDB secondary configuration only to General Management, without breaking User Management.
- Made tracked W1 service shutdown tolerant of already-exited processes.
- Removed process-level `exit` calls that caused the final orchestrator to return a false green in 2.5 seconds.
- Preserved exit-2 dedicated-lab results as BLOCKED in the final report.

## Missing mandatory harness/infrastructure

The requested stable-stack, health, evidence-recovery, stable API/UI thrice, correlation, redaction, lab provider/bundle, and final-unblock scripts do not exist at this repository tip. The available stack uses plain Node and no nodemon, but does not start a built frontend, secure primary Gateway, Agent, or Session Host and does not aggregate node/session readiness. No dedicated VM credentials or machine were supplied, and Hyper-V enumeration is not authorized for the current account.

`READY_FOR_W2=false` and `productionGaReady=false`.
