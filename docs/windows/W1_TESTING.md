# W1 Testing
Run frontend logic tests from `ui/`:
`npm run test:windows`

Run lint/build:
`npm run lint`
`npm run build`

Run Windows unit tests:
`dotnet test windows/CyFast.Windows.sln`

On a desktop without a usable interactive UIA environment, the UIA fixture integration test can hang. The acceptance runner applies a 15-second hang timeout, records this as a failed prerequisite, and continues to generate the report.

Run acceptance:
`powershell -ExecutionPolicy Bypass -File scripts/windows/run-w1-e2e.ps1`

The runner writes `W1_ACCEPTANCE_REPORT.json` and updates `W1_ACCEPTANCE_REPORT.md`. It has 24 checkpoints covering build/config/migrations, enrollment, gateway/agent/node/session, fixture UI actions, hashes, and negative states. It exits non-zero and records exact blockers when services, token, or an unlocked interactive desktop are unavailable. Use `-SkipLive` only to validate offline prerequisites; it never reports a pass.
