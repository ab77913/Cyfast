# Windows Connect W1 permissions

W1 permissions are provisioned per organization, never by a database seed with
a fixed organization or role ID. An administrator with `windows_agent.manage`
can call `POST /windows_permissions/bootstrap` while
`WINDOWS_AUTOMATION_ENABLED=true`.

The endpoint idempotently creates the W1 permission codes for the caller's
organization and assigns them to that organization's `Super Admin` role when
present. It is intended for organization setup and E2E environments.
