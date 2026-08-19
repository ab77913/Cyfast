# W1 Installation
Prerequisites: Windows interactive desktop, .NET SDK compatible with `net9.0`, General Management, Agent Gateway, database migration `09_windows_connect_w1.sql`, and Windows permissions seeded for the operator.

1. Set service `WINDOWS_AUTOMATION_ENABLED=true`; set UI `VITE_WINDOWS_AUTOMATION_ENABLED=true` only when testing the UI.
2. Apply the additive MySQL migration, start General Management and Agent Gateway, and create an enrollment token through the protected API.
3. Configure the Agent `ControlPlaneUrl`, `AgentGatewayUrl`, `Organization`, `EnrollmentToken`, pipe name, and transport policy. Do not commit these values.
4. Run elevated `scripts/windows/install-agent-dev.ps1`, start the Session Host inside the target user desktop with `start-session-host-dev.ps1`, then start the service.
5. Create an allowlisted application profile, wait for heartbeat/capabilities, then create a session.

To remove development installation use `uninstall-agent-dev.ps1`. Rollback is documented in [architecture](W1_ARCHITECTURE.md).
