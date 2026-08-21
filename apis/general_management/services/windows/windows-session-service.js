"use strict";
const crypto = require("crypto");
const { db, model, getById, list } = require("../../database/mysql/factories/windows-w1-factory");
const { validateCommandEnvelope } = require("./command-envelope");
const { writeOutbox } = require("./windows-outbox");
const { COMMAND_STATES, ensureManifest } = require("./windows-command-lifecycle");

async function createSession({ windows_node_id, organization_id, application_profile_id, requested_by }) {
  const session = await model("InteractiveSession").create({
    interactive_session_id: crypto.randomUUID(),
    windows_node_id,
    organization_id,
    application_profile_id,
    requested_by,
    status: "REQUESTED",
    created_by: requested_by,
  });
  await writeOutbox({
    organization_id,
    event_type: "windows.session.requested.v1",
    aggregate_id: session.interactive_session_id,
    payload: session.toJSON(),
    correlation_id: session.interactive_session_id,
  });
  return session;
}

async function session(id, organizationId) {
  return getById("InteractiveSession", "interactive_session_id", id, organizationId);
}

async function issueCommand(sessionValue, type, payload, actor, idempotencyKey, context = {}) {
  const node = await getById("WindowsNode", "windows_node_id", sessionValue.windows_node_id, sessionValue.organization_id);
  const base = validateCommandEnvelope({
    execution_command_id: crypto.randomUUID(),
    interactive_session_id: sessionValue.interactive_session_id,
    agent_id: node.agent_id,
    organization_id: sessionValue.organization_id,
    project_id: context.project_id || payload.project_id || null,
    execution_id: context.execution_id || payload.execution_id || payload.executionId || null,
    command_type: type,
    payload,
    idempotency_key: idempotencyKey || crypto.randomUUID(),
    correlation_id: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 5 * 60e3).toISOString(),
    status: COMMAND_STATES.QUEUED,
    attempt_count: 0,
  });
  const command = await db.sequelize.transaction(async (transaction) => {
    const existing = await model("ExecutionCommand").findOne({
      where: { organization_id: base.organization_id, idempotency_key: base.idempotency_key },
      transaction,
    });
    if (existing) return existing;
    const created = await model("ExecutionCommand").create({ ...base, created_by: actor }, { transaction });
    await writeOutbox({
      organization_id: base.organization_id,
      event_type: "windows.command.requested.v1",
      aggregate_id: created.execution_command_id,
      payload: base,
      correlation_id: base.correlation_id,
      transaction,
    });
    return created;
  });
  await ensureManifest(command);
  return command;
}

async function evidence(sessionId, organizationId) {
  return list("ExecutionEvidence", organizationId, { interactive_session_id: sessionId });
}

async function commandWithManifest(commandId, organizationId) {
  const command = await getById("ExecutionCommand", "execution_command_id", commandId, organizationId);
  if (!command) return null;
  const manifest = await model("WindowsCommandEvidenceManifest").findOne({
    where: { execution_command_id: commandId, organization_id: organizationId, deleted_date: null },
  });
  return {
    command,
    manifest,
    evidence_ready: manifest?.status === "EVIDENCE_COMPLETE" || (manifest && !(manifest.required_evidence_types || []).length),
    terminal: ["COMPLETED", "FAILED", "TIMED_OUT", "CANCELLED", "REJECTED", "EXPIRED", "EVIDENCE_FAILED"].includes(command.status),
  };
}

module.exports = { createSession, session, issueCommand, evidence, commandWithManifest };
