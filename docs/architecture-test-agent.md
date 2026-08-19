# Test Agent — architecture (summary)

**Path:** `test_agent/`  
**Runtime:** Python 3  
**Role:** CyFAST **test execution worker**: connects to **RabbitMQ**, registers with the orchestration engine, runs tests for **Robot Framework**, **Pytest**, **SpecFlow**, or **CAPL** (Windows), optionally **parses** suites to send discovered tests back, publishes **heartbeats**, **console logs**, **test status**, and **completion** messages; uploads reports via **HTTP** to the logger service.

## Entry points

- **CLI:** `cyfasttestagent` (see `setup.py`) → `test_agent.test_agent:main`.
- **Docker:** `Dockerfile_dockeragent_ubuntu` (Ubuntu base, browser tooling for Robot/Selenium-style runs).

## Major modules

| Area | Path | Notes |
|------|------|------|
| Orchestration loop | `test_agent/test_agent.py` | Declares queues, registers agent, dispatches callbacks. |
| Commands | `test_agent/agent_controller.py` | Execution, parsing, STOP/PAUSE/RESUME. |
| Messaging | `test_agent/common/publisher.py`, `message_builder.py` | Outbound payloads. |
| Plugins | `test_agent/plugins/*` | One package per framework + `git_plugin` for clones. |
| Infrastructure | `test_agent/utility/` | RabbitMQ wrapper, logger HTTP client, heartbeat thread, config loader. |

## Configuration

- **`AGENT_RUN_ENV`:** `local` | `staging` | `production` — selects blocks in `config/messaging.json` and `config/logging.json`.
- **`--config` / `--view`:** Interactive or read-only config for broker and logger URLs.
- **`-n` / `-t`:** Agent name and type (`ROBOT`, `PYTEST`, `SPECFLOW`, `CAPL`).

## External systems

| System | Interaction |
|--------|-------------|
| RabbitMQ | Exchanges for registration, deploy, control, parsing, status, heartbeats, logging topic. |
| Logger HTTP API | Activity/application logs and multipart execution upload. |
| Git | Clone test repositories when source type is repository-based. |

## Further reading

The repository maintains an extended specification (exchange and queue tables, sample execution JSON, proposed payload tweaks) at:

**`test_agent/architecture.md`**

Use that file for integration contracts and QA; this document only orients readers inside `docs/`.
