"use strict";

// W1 tables share CyFAST audit fields. Keeping their definitions together makes
// the cross-entity transaction boundary explicit while index.js still auto-loads them.
module.exports = function (sequelize, DataTypes) {
  const audit = {
    created_by: DataTypes.STRING(100), created_date: DataTypes.DATE,
    modified_by: DataTypes.STRING(100), modified_date: DataTypes.DATE,
    deleted_by: DataTypes.STRING(100), deleted_date: DataTypes.DATE,
  };
  const define = (name, tableName, fields, options = {}) => sequelize.define(name, {
    ...fields, ...audit,
  }, { tableName, timestamps: true, createdAt: "created_date", updatedAt: "modified_date", deletedAt: "deleted_date", ...options });
  const id = (field, type = DataTypes.BIGINT) => ({ [field]: { type, primaryKey: true, autoIncrement: type === DataTypes.BIGINT } });
  const org = { organization_id: { type: DataTypes.INTEGER, allowNull: false } };
  const models = {
    AgentEnrollmentToken: define("AgentEnrollmentToken", "agent_enrollment_token", { ...id("agent_enrollment_token_id"), ...org, project_id: DataTypes.INTEGER, token_hash: { type: DataTypes.STRING(64), allowNull: false }, expires_at: DataTypes.DATE, allowed_platform: DataTypes.STRING(32), consumed_at: DataTypes.DATE, consumed_by_agent_id: DataTypes.STRING(64) }),
    AgentIdentity: define("AgentIdentity", "agent_identity", { ...id("agent_id", DataTypes.STRING(64)), ...org, public_key: DataTypes.TEXT, status: DataTypes.STRING(20), agent_version: DataTypes.STRING(64), os: DataTypes.STRING(64), architecture: DataTypes.STRING(32), revoked_at: DataTypes.DATE }),
    AgentCertificate: define("AgentCertificate", "agent_certificate", { ...id("agent_certificate_id"), ...org, agent_id: DataTypes.STRING(64), certificate_fingerprint: DataTypes.STRING(64), expires_at: DataTypes.DATE, metadata: DataTypes.JSON }),
    AgentInstallation: define("AgentInstallation", "agent_installation", { ...id("agent_installation_id"), ...org, agent_id: DataTypes.STRING(64), hostname: DataTypes.STRING(255), installed_at: DataTypes.DATE, metadata: DataTypes.JSON }),
    AgentCapability: define("AgentCapability", "agent_capability", { ...id("agent_capability_id"), ...org, agent_id: DataTypes.STRING(64), capability: DataTypes.STRING(128), details: DataTypes.JSON }),
    AgentHealth: define("AgentHealth", "agent_health", { ...id("agent_health_id"), ...org, agent_id: DataTypes.STRING(64), status: DataTypes.STRING(32), observed_at: DataTypes.DATE, details: DataTypes.JSON }),
    WindowsNode: define("WindowsNode", "windows_node", { ...id("windows_node_id"), ...org, agent_id: DataTypes.STRING(64), name: DataTypes.STRING(255), status: DataTypes.STRING(32), last_seen_at: DataTypes.DATE, metadata: DataTypes.JSON }),
    WindowsApplicationProfile: define("WindowsApplicationProfile", "windows_application_profile", { ...id("windows_application_profile_id"), ...org, project_id: DataTypes.INTEGER, name: DataTypes.STRING(255), executable_path: DataTypes.TEXT, allowlist: DataTypes.JSON, configuration: DataTypes.JSON }),
    InteractiveSession: define("InteractiveSession", "interactive_session", { ...id("interactive_session_id", DataTypes.STRING(64)), ...org, windows_node_id: DataTypes.BIGINT, application_profile_id: DataTypes.BIGINT, status: DataTypes.STRING(32), requested_by: DataTypes.STRING(100), started_at: DataTypes.DATE, ended_at: DataTypes.DATE, metadata: DataTypes.JSON }),
    UiSnapshot: define("UiSnapshot", "ui_snapshot", { ...id("ui_snapshot_id"), ...org, interactive_session_id: DataTypes.STRING(64), tree: DataTypes.JSON }),
    UiElement: define("UiElement", "ui_element", { ...id("ui_element_id"), ...org, ui_snapshot_id: DataTypes.BIGINT, element_path: DataTypes.STRING(1024), properties: DataTypes.JSON }),
    ExecutionCommand: define("ExecutionCommand", "execution_command", { ...id("execution_command_id", DataTypes.STRING(64)), ...org, project_id: DataTypes.INTEGER, execution_id: DataTypes.STRING(64), interactive_session_id: DataTypes.STRING(64), agent_id: DataTypes.STRING(64), command_type: DataTypes.STRING(128), payload: DataTypes.JSON, payload_hash: DataTypes.STRING(64), idempotency_key: DataTypes.STRING(128), expires_at: DataTypes.DATE, status: DataTypes.STRING(32), attempt_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, correlation_id: DataTypes.STRING(64), result: DataTypes.JSON, result_received_at: DataTypes.DATE }),
    ExecutionCommandResult: define("ExecutionCommandResult", "execution_command_result", { ...id("execution_command_result_id"), ...org, execution_command_id: DataTypes.STRING(64), status: DataTypes.STRING(32), result: DataTypes.JSON, received_at: DataTypes.DATE }),
    ExecutionEvidence: define("ExecutionEvidence", "execution_evidence", { ...id("execution_evidence_id", DataTypes.STRING(64)), ...org, execution_command_id: DataTypes.STRING(64), interactive_session_id: DataTypes.STRING(64), storage_file_id: DataTypes.STRING(64), content_hash: DataTypes.STRING(64), content_type: DataTypes.STRING(255), retention_classification: DataTypes.STRING(64), filename: DataTypes.STRING(255) }),
    WindowsCommandEvidenceManifest: define("WindowsCommandEvidenceManifest", "windows_command_evidence_manifest", { ...id("windows_command_evidence_manifest_id", DataTypes.STRING(64)), ...org, project_id: DataTypes.INTEGER, execution_command_id: DataTypes.STRING(64), interactive_session_id: DataTypes.STRING(64), command_type: DataTypes.STRING(128), required_evidence_types: DataTypes.JSON, received_evidence_types: DataTypes.JSON, content_hashes: DataTypes.JSON, upload_attempts: DataTypes.INTEGER, status: DataTypes.STRING(32), failure_reason: DataTypes.STRING(512), created_at: DataTypes.DATE, completed_at: DataTypes.DATE }),
    WindowsAuditEvent: define("WindowsAuditEvent", "windows_audit_event", { ...id("windows_audit_event_id"), ...org, agent_id: DataTypes.STRING(64), event_type: DataTypes.STRING(128), actor_id: DataTypes.STRING(100), correlation_id: DataTypes.STRING(64), details: DataTypes.JSON }),
    WindowsOutboxEvent: define("WindowsOutboxEvent", "windows_outbox_event", { ...id("windows_outbox_event_id"), ...org, event_type: DataTypes.STRING(128), aggregate_id: DataTypes.STRING(64), payload: DataTypes.JSON, correlation_id: DataTypes.STRING(64), published_at: DataTypes.DATE, attempts: DataTypes.INTEGER }),
  };
  return { name: "WindowsW1Models", models };
};
