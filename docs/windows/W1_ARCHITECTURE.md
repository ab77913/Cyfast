# W1 Architecture
```mermaid
flowchart LR
Operator[Operator UI] --> GM[General Management]
GM --> Outbox[Windows Outbox]
Outbox --> Gateway[Agent Gateway]
Gateway -->|outbound TLS WebSocket| Agent[Windows Agent]
Agent -->|named pipe| Host[Interactive Session Host]
Host --> UIA[Windows UI Automation]
Host --> Fixture[Approved Desktop App]
GM --> Evidence[Protected Evidence Storage]
```
The agent is outbound-only and never connects to RabbitMQ. The Session Host runs in the user desktop context; the service cannot automate a locked/non-interactive desktop.

```mermaid
sequenceDiagram
Operator->>GM: create session / command
GM->>Gateway: durable outbox command
Gateway->>Agent: authenticated command envelope
Agent->>Host: named-pipe request
Host-->>Agent: result/evidence metadata
Agent-->>Gateway: command result
Gateway-->>GM: status and evidence
```
Rollback: disable `WINDOWS_AUTOMATION_ENABLED`, stop the agent/gateway, apply `09_windows_connect_w1_down.sql` only when removing W1 tables, then revert deployment.
