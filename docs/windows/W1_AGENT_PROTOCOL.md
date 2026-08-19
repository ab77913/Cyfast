# W1 Agent Protocol
The agent enrolls once with a short-lived token and public key, retains its identity with DPAPI, then opens an outbound authenticated WebSocket to Agent Gateway. Gateway challenges the connection; the agent signs the nonce and advertises capabilities.

Commands use [command-envelope.schema.json](../../contracts/windows/command-envelope.schema.json), schema version `1.0`, an expiry, correlation ID, idempotency key, and SHA-256 payload hash. The agent rejects expired, duplicate, unsupported, or shell/PowerShell commands. It relays allowed requests through a local named pipe to Session Host and returns typed results.

Allowed W1 commands are health, capability discovery, session lifecycle, approved profile launch/attach, UI inspection/screenshot, invoke/set/select, and graceful close. Results are spooled when IPC is unavailable; no inbound desktop port or WebRTC channel exists.
