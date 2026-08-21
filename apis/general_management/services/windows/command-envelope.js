"use strict";

const crypto = require("crypto");

const ALLOWED_COMMANDS = new Set([
  "windows.health",
  "windows.get_capabilities",
  "windows.start_session",
  "windows.end_session",
  "windows.launch_profile",
  "windows.attach_profile",
  "windows.inspect_ui",
  "windows.capture_screenshot",
  "windows.invoke_element",
  "windows.set_element_value",
  "windows.select_element",
  "windows.close_application",
  "windows.check_runtime",
  "windows.recover_runtime",
  "windows.validate_robot_package",
  "windows.start_robot_job",
  "windows.get_robot_job_status",
  "windows.cancel_robot_job",
  "windows.collect_robot_job_result",
]);

const FORBIDDEN_COMMANDS = new Set([
  "windows.shell",
  "windows.run_arbitrary_command",
  "windows.run_powershell_text",
  "session.launch",
  "session.attach",
  "session.inspect",
  "session.action",
  "session.screenshot",
  "session.end",
]);

const ACTION_TO_COMMAND = {
  launch: "windows.launch_profile",
  attach: "windows.attach_profile",
  inspect: "windows.inspect_ui",
  action: "windows.invoke_element",
  actions: "windows.invoke_element",
  screenshot: "windows.capture_screenshot",
  screenshots: "windows.capture_screenshot",
  end: "windows.end_session",
  set_value: "windows.set_element_value",
  select: "windows.select_element",
  close: "windows.close_application",
  check_runtime: "windows.check_runtime",
  recover_runtime: "windows.recover_runtime",
  validate_robot_package: "windows.validate_robot_package",
  start_robot_job: "windows.start_robot_job",
  get_robot_job_status: "windows.get_robot_job_status",
  cancel_robot_job: "windows.cancel_robot_job",
  collect_robot_job_result: "windows.collect_robot_job_result",
};

function canonicalize(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
}

const payloadHash = (payload) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload || {}))).digest("hex");

function mapActionToCommandType(action, body = {}) {
  if (body.command_type) return body.command_type;
  if (body.action === "set_value" || body.actionType === "set_value") {
    return "windows.set_element_value";
  }
  if (body.action === "select" || body.actionType === "select") {
    return "windows.select_element";
  }
  if (body.action === "close" || body.actionType === "close") {
    return "windows.close_application";
  }
  return ACTION_TO_COMMAND[action] || null;
}

function validateCommandEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw Object.assign(new Error("Command envelope is required"), {
      code: "COMMAND_INVALID",
      statusCode: 400,
    });
  }

  const commandType = envelope.command_type || envelope.commandType;
  if (FORBIDDEN_COMMANDS.has(commandType)) {
    throw Object.assign(new Error("Command type is forbidden"), {
      code: "COMMAND_REJECTED",
      statusCode: 400,
    });
  }
  if (!ALLOWED_COMMANDS.has(commandType)) {
    throw Object.assign(new Error("Command type is not allowed"), {
      code: "COMMAND_NOT_ALLOWED",
      statusCode: 400,
    });
  }

  const schemaVersion = envelope.schema_version || envelope.schemaVersion || "1.0";
  if (schemaVersion !== "1.0") {
    throw Object.assign(new Error("Unsupported schema version"), {
      code: "COMMAND_INVALID",
      statusCode: 400,
    });
  }

  const agentId = envelope.agent_id || envelope.resourceId;
  const idempotencyKey = envelope.idempotency_key || envelope.idempotencyKey;
  const correlationId = envelope.correlation_id || envelope.correlationId;
  if (!agentId || !idempotencyKey || !correlationId) {
    throw Object.assign(new Error("Command identifiers are required"), {
      code: "COMMAND_INVALID",
      statusCode: 400,
    });
  }

  const expiresAt = envelope.expires_at || envelope.expiresAt;
  if (!expiresAt || new Date(expiresAt) <= new Date()) {
    throw Object.assign(new Error("Command has expired"), {
      code: "COMMAND_EXPIRED",
      statusCode: 400,
    });
  }

  const payload = envelope.payload || {};
  const hash = payloadHash(payload);
  const providedHash = envelope.payload_hash || envelope.payloadHash;
  if (providedHash && providedHash !== hash) {
    throw Object.assign(new Error("Payload hash mismatch"), {
      code: "COMMAND_INVALID",
      statusCode: 400,
    });
  }

  return {
    execution_command_id:
      envelope.execution_command_id || envelope.messageId || crypto.randomUUID(),
    interactive_session_id: envelope.interactive_session_id || envelope.sessionId || null,
    agent_id: agentId,
    organization_id: envelope.organization_id || envelope.organizationId,
    project_id: envelope.project_id || envelope.projectId || null,
    command_type: commandType,
    payload,
    payload_hash: hash,
    idempotency_key: idempotencyKey,
    correlation_id: correlationId,
    expires_at: expiresAt,
    schema_version: schemaVersion,
    status: envelope.status || "REQUESTED",
  };
}

module.exports = {
  ALLOWED_COMMANDS,
  FORBIDDEN_COMMANDS,
  ACTION_TO_COMMAND,
  payloadHash,
  mapActionToCommandType,
  validateCommandEnvelope,
};
