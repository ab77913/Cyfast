# CyFAST implementation status — 2026-08-21

This record describes what is present in `main` after consolidating every remote `codex/*` branch. It is an implementation inventory, not a production-readiness declaration.

## Branch consolidation

All nine remote feature branches are ancestors of `main` and have zero commits ahead of it. No synthetic merge commits or regressions were required. `main` contains the project-aware generation, lifecycle, orchestration, target UI, unified execution, and Windows deterministic-execution lines.

## Implemented

- React/Vite, Fastify services, FastAPI AI engine, and MySQL-backed platform structure.
- Project-aware AI generation with immutable automation project profiles, lineage, multifile Robot packages, validation, and safe create/update/reuse operations.
- Execution targets and adapters, including the first-party outbound Windows Agent route.
- Windows Agent enrollment, machine identity, heartbeat/connection handling, durable commands, acknowledgements, expiry, replay-oriented state, and strict command allowlists.
- Session 0 background service and interactive-session host separation with HMAC-signed filesystem IPC and bounded payloads.
- Windows application profiles, runtime supervision/recovery, application launch, Appium/WinAppDriver readiness, and real W3C session validation.
- Asynchronous Robot job start/status/cancel/result commands with safe package validation and bounded execution.
- Persisted execution state, events/SSE replay, central artifact metadata/upload, evidence checks, failure classification, bounded repair foundations, reruns, and trace links.
- Run-with-AI execution/proof UI foundations and agent/runtime visibility.
- A strict Windows proof contract requiring real, non-simulated interactive desktop execution, confirmed application control, a real session, meaningful actions and assertions, zero Robot exit code, centralized `output.xml`, and required evidence.
- CI workflows for general orchestration, AI generation, UI build/tests, security checks, migrations, and Windows .NET build/tests.

## Implemented foundations, not yet complete product features

- Inspector primitives exist (screenshot/UI-tree capture and locator-related commands), but the complete screenshot click-to-element, candidate scoring, validation, and reusable locator-repository experience is not certified end to end.
- Recorder and semantic automation foundations exist, but the first-party Windows Recorder workflow is not complete or certified.
- Failure classification and bounded repair controls exist; evidence-driven repair approval, all allowed repair types, and measured fleet-level healing are not complete.
- Generic target/adapter abstractions exist; the full Web, mobile, API, protocol, hardware, CAN, serial, and hosted-Windows adapter catalog is not implemented.

## Not yet complete

- Two-phase agent credential rotation.
- Signed agent update, health verification, automatic rollback, and fleet-wide update controls.
- Production scheduler features: pools, durable queue policy, desktop leases, reservations, capability matching, and parallel-execution controls.
- Hosted Windows static/cloud pools.
- Full Inspector and Recorder user journeys.
- Complete cross-platform and protocol/hardware plugin suite.
- Full production reporting/export matrix and all production hardening/acceptance exercises.

## Certification gate

CyFAST Windows Automation Milestone 1 still requires an unlocked real Windows host with the target application, Appium/Windows driver runtime, and centrally uploaded evidence. CI and Linux-side tests can verify contracts and build the Windows code, but they cannot certify a real desktop action or assertion. Until that run succeeds, the platform must not describe the first-party Windows path—or the complete master plan—as production-certified.

The next product action is therefore the real-host milestone run: generated test → application profile → enrolled outbound agent → secure IPC → runtime recovery → application launch/control → Robot action and assertion → centralized evidence → proof-validated frontend PASS.
