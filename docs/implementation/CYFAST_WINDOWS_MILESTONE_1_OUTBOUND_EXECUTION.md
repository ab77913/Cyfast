# CyFAST Windows Milestone 1: outbound deterministic execution

## Implemented path

The Windows execution target now uses the first-party outbound transport when its configuration contains:

```json
{
  "transport": "OUTBOUND_AGENT",
  "interactive_session_id": "<centrally-created-session>",
  "application_profile_id": "<project-scoped-profile>",
  "auto_recover_runtime": true
}
```

Its endpoint is the non-network routing marker `outbound://windows-agent`. A public Appium,
WinAppDriver, agent, or desktop endpoint is rejected for this target type.

The server performs this sequence through the durable command queue and outbound Agent Gateway:

1. `windows.check_runtime`
2. `windows.recover_runtime` when policy allows and readiness is false
3. `windows.check_runtime`
4. `windows.validate_robot_package`
5. `windows.start_robot_job`
6. bounded `windows.get_robot_job_status` polling
7. `windows.collect_robot_job_result`
8. central artifact upload and proof validation

Robot execution is asynchronous. The browser request returns after dispatch; completion updates the
persisted execution run and event stream. Agent reconnect result replay is correlated by the command
request ID and result ingestion is idempotent.

## PASS boundary

The outbound adapter maps the Agent's signed result into the central proof contract. A Windows PASS
still requires real execution, no simulation, desktop execution, a real driver session, exit code zero,
at least one passed meaningful action, at least one passed meaningful assertion, and all mandatory
evidence. Command completion by itself is not a PASS.

Mandatory Robot collection evidence includes `output.xml`, `log.html`, `report.html`, stdout, stderr,
and the runtime proof manifest. Screenshots remain required by the Windows execution evidence policy.

## Remaining certification gate

Repository tests can validate orchestration, schemas, policy, and artifact handling. Final product
certification additionally requires a real unlocked Windows desktop, the approved application binary,
Appium and WinAppDriver, a created W3C session, and centrally retrievable evidence from an actual run.
No simulated or dry-run result may satisfy that gate.
