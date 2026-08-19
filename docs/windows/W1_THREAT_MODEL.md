# W1 Threat Model
| Asset | Threat | Control |
|---|---|---|
| Enrollment | Token theft/replay | short expiry, one-time consumption, no token logs |
| Agent identity | Impersonation | public-key enrollment, signed gateway nonce, revocation |
| Desktop | Remote code execution | fixed allowlisted command types; no shell, PowerShell, or arbitrary executable command |
| UI automation | Cross-tenant/control abuse | organization-scoped records, permission checks, profile allowlists |
| Evidence | Disclosure/tampering | authenticated content route, SHA-256, no public storage URLs |
| Reliability | replay/loss | expiry, idempotency keys, correlation IDs, outbox and result spool |

Never place secrets in profile metadata, UI trees, screenshots, diagnostics, or reports. `collect-diagnostics.ps1` redacts common credential keys and values, but operators must review output before sharing.

W1 does not mitigate compromise of an already-authorized interactive Windows user, malicious target applications, or screen-visible sensitive data. It is out of scope to provide malware protection, cross-platform agents, WebRTC streaming, AI healing, VM provisioning, or public installers.
