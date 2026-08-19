# W1 Troubleshooting
- `FEATURE_DISABLED`: set `WINDOWS_AUTOMATION_ENABLED=true` for General Management; rebuild UI after changing its Vite flag.
- `NoInteractiveSession` or `SessionLocked`: log in to the target desktop and unlock it; services cannot automate Session 0.
- Agent enrollment fails: verify token expiry, Agent Gateway URL, organization, TLS trust, and that the token has not been consumed.
- Node remains offline: verify outbound Gateway connectivity, signed challenge/authentication, agent service account, and heartbeat configuration.
- `APPLICATION_NOT_APPROVED` or `InvalidProfile`: create a valid absolute-path allowlisted profile; UNC paths need explicit policy and hashes must match.
- UIA errors: use Inspect first, select stable AutomationId candidates, ensure the target window is present/enabled, and retry after the app is responsive.
- Missing evidence: inspect command result/audit entries, storage authorization, and evidence SHA-256; evidence downloads are intentionally not public.

Collect safe diagnostic data with `scripts/windows/collect-diagnostics.ps1`. The acceptance runner’s Markdown and JSON reports are the source of truth for blocked local environments.
