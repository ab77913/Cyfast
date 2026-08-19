# Test Agent – Architecture

The **test_agent** (CyFAST Test Agent) is a Python service that registers with a test orchestration engine over RabbitMQ, executes tests for multiple frameworks (Robot, Pytest, SpecFlow, CAPL), and publishes status, logs, and reports back to the engine.

---

## 1. Overview

| Aspect | Description |
|--------|-------------|
| **Purpose** | Execute and parse tests for CyFAST test orchestration |
| **Entry Point** | `cyfasttestagent` CLI (from `setup.py`) |
| **Main Module** | `test_agent.test_agent:main` |
| **Version** | 2.1.0 |

---

## 2. Directory Structure

```
test_agent/
├── test_agent/                    # Main package
│   ├── __version__.py             # Version (2.1.0)
│   ├── test_agent.py              # Main entry point & TestAgent orchestrator
│   ├── agent_controller.py        # Command handling & orchestration
│   ├── configure_agent.py         # Interactive configuration
│   ├── common/                    # Shared abstractions
│   │   ├── agent_base.py          # BaseFramework (executor base class)
│   │   ├── parser_base.py        # TestParserBase (parser base class)
│   │   ├── repo_base.py          # RepoBase (repository base class)
│   │   ├── publisher.py          # Message publishing to RabbitMQ
│   │   ├── message_builder.py    # Payload construction
│   │   ├── framework_registry.py # Plugin registry (ROBOT, PYTEST, SPECFLOW, CAPL)
│   │   ├── configuration_settings.py # Runtime config
│   │   └── test_agent_dto.py     # DTOs, enums, AgentInfo singleton
│   ├── config/                    # Configuration files
│   │   ├── messaging.json        # RabbitMQ config (local/staging/production)
│   │   └── logging.json          # Logger config per environment
│   ├── plugins/                   # Framework-specific plugins
│   │   ├── robot_plugin/         # Robot Framework
│   │   ├── pytest_plugin/        # Pytest
│   │   ├── specflow_plugin/      # SpecFlow (BDD)
│   │   ├── capl_plugin/          # CAPL (CANoe, Windows only)
│   │   └── git_plugin/           # Git repository cloning
│   └── utility/                   # Infrastructure services
│       ├── service_initializer.py # Config loader, MQ & logger setup
│       ├── heartbeat_manager.py  # Heartbeat sender
│       ├── messaging_service/    # RabbitMQ wrapper
│       └── logger_service/       # File, HTTP, RabbitMQ logging
├── setup.py                       # Package definition, entry point
├── requirements.txt              # Dependencies
└── Dockerfile_dockeragent_ubuntu  # Docker image for agent
```

---

## 3. Core Components

### 3.1 Main Modules

| Module | Responsibility |
|--------|----------------|
| **TestAgent** | Main orchestrator: message loop, callbacks, thread management |
| **AgentController** | Handles parsing, execution, control commands; delegates to framework plugins |
| **ServiceInitializer** | Loads config, creates MessagingService and LoggerService |
| **Publisher** | Publishes agent status, console logs, test status, execution completion, reports |
| **Framework Registry** | Maps agent types to executor and parser classes |
| **BaseFramework** | Base for executors: configure, run, report; env vars, sys.path |
| **TestParserBase** | Base for parsers: `parse(suite_name, directory_path, ...)` |
| **RepoBase** | Base for repos: `download(data, agent_name, parsing)` |
| **MessageBuilder** | Builds console log, test status, orchestration completion payloads |
| **ConfigurationSettings** | Holds orchestration execution config (IDs, paths, flags) |
| **HeartbeatManager** | Sends heartbeat every 2 seconds to `heartbeat_exchange` |

### 3.2 Framework Plugins

| Plugin | Executor | Parser | Purpose |
|--------|----------|--------|---------|
| **robot_plugin** | RobotFramework | RobotParser | Robot Framework tests |
| **pytest_plugin** | PytestFramework | PyTestParser | Pytest tests |
| **specflow_plugin** | SpecFlowFramework | SpecflowParser | SpecFlow BDD tests |
| **capl_plugin** | CAPLFramework | CAPLParser | CAPL/CANoe (Windows) |
| **git_plugin** | N/A | N/A | Git clone for test sources |

---

## 4. Application Startup

### 4.1 CLI Arguments

- `--config` – Run interactive configuration and exit
- `--view` – Show current config and exit
- `--parse` – Enable parsing mode
- `-n`, `-t` – Agent name and type
- `--console` – Enable console logs

### 4.2 Startup Flow

1. **`main()`** parses CLI args; `--config` / `--view` exit early.
2. **`cyfast_test_agent_main()`** resolves agent type (ROBOT, PYTEST, CAPL, SPECFLOW) and name.
3. **TestAgent** is created with ServiceInitializer, Publisher, AgentController.
4. **`listener()`**:
   - Declares RabbitMQ exchanges and queues
   - Binds queues with routing keys
   - Registers callbacks for deploy, registration ack, commands, parsing, control
   - Publishes registration to `agent_registration_exchange`
   - Starts main consume loop
5. **After registration ack**:
   - Starts HeartbeatManager thread
   - Starts execution command thread (control queue consumer)

---

## 5. Data Flows

### 5.1 Registration Flow

```
TestAgent.listener()
  → Declares exchanges/queues
  → Publishes AgentInfo to agent_registration_exchange
  → Engine responds on ack_agent_registered
  → agent_registered_callback()
    → Starts HeartbeatManager, execution command thread
    → AgentController.agent_registered() stores agent_id
    → Publishes READY status
```

### 5.2 Execution Flow

```
Engine → agent_execution_deploy_exchange (routing: {agent_name}.*)
  → execution_deploy_callback()
  → AgentController.start_execution(payload)
    → get_tests(): GitRepo.download() or use directory_path
    → framework_cls = get_framework_executor_class(agent_type)
    → framework.run(data)
      → configure() → execute_tests() → generate_and_upload_reports()
    → Publisher: agent status, execution status, test status, completion
```

### 5.3 Parsing Flow

```
Engine → agent_parsing_exchange (routing: {agent_name}.*)
  → parsing_callback()
  → AgentController.parse_data(payload)
    → GitRepo.download() if REPOSITORY source
    → framework_cls = get_framework_parser_class(agent_type)
    → framework.parse(...)
    → Publisher.publish_parsed_tests() → test_parsing_response_queue
```

### 5.4 Control Flow (STOP/PAUSE/RESUME)

```
Engine → orchestration_control_exchange (routing: {agent_name}.command)
  → execution_control_callback()
  → AgentController.execution_control_command()
    → STOP: stop_execution_event.set()
    → PAUSE: pause_execution_event.set()
    → RESUME: pause_execution_event.clear()
```

---

## 6. RabbitMQ Messaging

### 6.1 Exchanges

| Exchange | Type | Purpose |
|----------|------|---------|
| agent_registration_exchange | direct | Agent registration |
| agent_status_exchange | topic | Agent status updates |
| agent_execution_deploy_exchange | topic | Execution deploy commands |
| ack_agent_registered | topic | Registration acknowledgment |
| agent_command_exchange | topic | Commands (e.g. KILL) |
| agent_parsing_exchange | topic | Parsing requests |
| orchestration_control_exchange | topic | STOP/PAUSE/RESUME |
| console_log_exchange | topic | Console logs |
| test_status_exchange | topic | Real-time test status |
| execution_completion_status_exchange | topic | Execution completion |
| heartbeat_exchange | topic | Heartbeats |
| cyfastlogs | topic | Logging to RabbitMQ |

### 6.2 Queues (agent-specific)

- `{agent_name}Receive-queue` – execution deploy
- `{agent_name}_registered` – registration ack
- `{agent_name}command_queue` – agent commands
- `{agent_name}control_queue` – execution control
- `{agent_name}parse_queue` – parsing (if enabled)

---

## 7. Configuration

### 7.1 Environment Variable

- **`AGENT_RUN_ENV`**: `local` (default), `staging`, or `production` – selects config section in JSON files.

### 7.2 Config Files

**`config/messaging.json`** – RabbitMQ:

- `local`: localhost:5672
- `staging`: host.docker.internal
- `production`: 20.204.6.69

**`config/logging.json`** – Logger:

- `enable_file_logs`, `enable_http_post_logs`, `enable_rabbitmq_logs`
- `logger_service_url` (e.g. http://localhost:8090)
- `rabbitmq_logging_hostname`

### 7.3 Interactive Configuration

- `--config`: Prompts for RabbitMQ and logger settings and writes to JSON.
- `--view`: Prints current config for the active environment.

---

## 8. External Integrations

### 8.1 HTTP

- **Logger service** (`logger_service_url`): `/logs/activity`, `/logs/application`, `/logs/execution/upload`
- Report upload: POST to `{logger_url}/logs/execution/upload` with multipart form data

### 8.2 External Systems

- **Test engine**: Sends registration, deploy, parsing, and control messages via RabbitMQ
- **Logger service**: Receives logs and execution reports via HTTP
- **Git**: Clones test repositories (via GitRepo plugin)

---

## 9. Dependencies

| Package | Purpose |
|---------|---------|
| pika | RabbitMQ client |
| unique_names_generator | Random agent names |
| gitpython | Git operations |
| python-dotenv | Environment variables |
| requests | HTTP (logger, report upload) |
| pytest, pytest-html, pytest-bdd, pytest-json-report | Pytest execution & reports |
| robotframework | Robot Framework |
| python_logging_rabbitmq | RabbitMQ logging handler |
| PyYAML | YAML config |
| selenium | Browser automation |

---

## 10. Orchestration Execution Request Message

The execution deploy command received on `agent_execution_deploy_exchange` follows this structure:

```json
{
  "test_cases_source": {
    "type": "REPOSITORY",
    "configs": {
      "directory_path": "/automation/tests",
      "suite_name": "RegressionSuite",
      "username": "repo_user",
      "password": "repo_password",
      "access_token": "ghp_xxxxxxxxxx",
      "url": "https://github.com/company/test-repo.git",
      "branch": "main",
      "repository_type": "git"
    }
  },
  "user_id": "user_1024",
  "project_id": 2001,
  "orchestration_id": 501,
  "orchestration_name": "Nightly Regression Run",
  "orchestration_execution_id": 90001,
  "execution": {
    "test_fw_type": "PYTEST",
    "options": {
      "mode": "SEQUENTIAL",
      "base": "TEST_CASE",
      "on_error_abort": true
    },
    "selected_test_cases": [
      {
        "file_name": "test_login.py",
        "test_name": "test_valid_login",
        "test_case_no": "TC_001",
        "test_case_id": "TCID_001",
        "environment_id": "ENV_01",
        "file_path": "/automation/tests/auth/"
      },
      {
        "file_name": "test_payment.py",
        "test_name": "test_successful_payment",
        "test_case_no": "TC_002",
        "test_case_id": "TCID_002",
        "environment_id": "ENV_01",
        "file_path": "/automation/tests/payment/"
      }
    ]
  },
  "env_var": {
    "Path": "C:/Users/",
    "PYTHONDONOTWRITEBYTECODE": 1
  },
  "cmd_arg": [
    "--save-screenshot"
  ]
}
```

### 10.1 Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `test_cases_source` | object | Source of tests: `REPOSITORY`, `SHARED_DIRECTORY`, or `LOCAL_DIRECTORY` |
| `test_cases_source.configs` | object | Repo URL, branch, credentials; or `directory_path` for local/shared |
| `execution.test_fw_type` | string | `ROBOT`, `PYTEST`, `SPECFLOW`, or `CAPL` |
| `execution.selected_test_cases` | array | List of test cases to execute |
| `execution.selected_test_cases[].file_name` | string | Test file name |
| `execution.selected_test_cases[].test_name` | string | Test case/spec name |
| `execution.selected_test_cases[].file_path` | string | Path within the test directory |
| `env_var` | object | Environment variables for execution |
| `cmd_arg` | array | Command-line arguments passed to the test runner |

### 10.2 Single Test Scenario Execution

**Current behavior:** The structure already supports a single test. Send `selected_test_cases` with one element:

```json
"selected_test_cases": [
  {
    "file_name": "test_login.py",
    "test_name": "test_valid_login",
    "test_case_no": "TC_001",
    "test_case_id": "TCID_001",
    "environment_id": "ENV_01",
    "file_path": "/automation/tests/auth/"
  }
]
```

**Proposed optional simplification:** For engines that always know when exactly one test is selected, an optional singular field can be supported:

```json
"execution": {
  "test_fw_type": "PYTEST",
  "options": { "mode": "SEQUENTIAL", "base": "TEST_CASE", "on_error_abort": true },
  "selected_test_case": {
    "file_name": "test_login.py",
    "test_name": "test_valid_login",
    "test_case_no": "TC_001",
    "test_case_id": "TCID_001",
    "environment_id": "ENV_01",
    "file_path": "/automation/tests/auth/"
  }
}
```

**Implementation change:** In `AgentController.start_execution()` (or the framework executor), normalize the payload before processing:

```python
# Normalize: if selected_test_case (singular) is present, convert to selected_test_cases (array)
execution = data.get("execution", {})
if "selected_test_case" in execution and "selected_test_cases" not in execution:
    execution["selected_test_cases"] = [execution["selected_test_case"]]
```

This keeps backward compatibility: `selected_test_cases` (array) remains the canonical format; `selected_test_case` (object) is an optional convenience for single-test runs.

---

## 11. Deployment

### 11.1 Docker

- **Image**: `Dockerfile_dockeragent_ubuntu`
- **Base**: Ubuntu 20.04
- **Includes**: Python 3, Git, Firefox, GeckoDriver, Robot Selenium libraries
- **Default CMD**: `python3 -u test_agent/test_agent.py --parse -n DEFAULT_AGENT`

---

## Summary

The test_agent is a CyFAST test execution agent that:

- Registers with a test engine over RabbitMQ
- Executes tests for Robot, Pytest, SpecFlow, and CAPL
- Parses test cases when `--parse` is used
- Supports Git and local/shared directories as test sources
- Publishes status, logs, and reports to RabbitMQ and an HTTP logger service
- Handles STOP/PAUSE/RESUME via RabbitMQ control messages
- Uses environment-based config (local/staging/production) for messaging and logging
