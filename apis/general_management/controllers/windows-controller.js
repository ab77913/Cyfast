"use strict";
const axios = require("axios");
const enrollment = require("../services/windows/enrollment-service");
const authz = require("../services/windows/windows-authz");
const nodes = require("../services/windows/windows-node-service");
const sessions = require("../services/windows/windows-session-service");
const profiles = require("../services/windows/windows-application-profile-service");
const evidence = require("../services/windows/windows-evidence-service");
const { model } = require("../database/mysql/factories/windows-w1-factory");
const { mapActionToCommandType } = require("../services/windows/command-envelope");
const { assertInternalAuth, getInternalApiToken } = require("../services/windows/windows-security-config");
const { ensurePermissionsForOrganization } = require("../services/windows/windows-permission-bootstrap");
const { reconcileCommandCompletion, COMMAND_STATES } = require("../services/windows/windows-command-lifecycle");
const assertInternal = (request) => assertInternalAuth(request.headers.authorization);
function fail(reply, error) { return reply.code(error.statusCode || 500).send({ code: error.code || "WINDOWS_ERROR", message: error.message }); }
async function createEnrollment(request, reply) { try { const actor = await authz.requirePermission(request, "windows_agent.enroll"); const token = await enrollment.createToken({ ...request.body, organization_id: actor.organizationId, created_by: actor.userId }); return reply.code(201).send({ token, expires_at: request.body.expires_at }); } catch (e) { return fail(reply, e); } }
async function enrollAgent(request, reply) { try { assertInternal(request); const value = await enrollment.consumeToken(request.body); return reply.code(201).send(value); } catch (e) { return fail(reply, e); } }
async function listNodes(request, reply) { try { const a = await authz.requirePermission(request, "windows_agent.read"); return reply.send(await nodes.nodes(a.organizationId)); } catch (e) { return fail(reply, e); } }
async function getNode(request, reply) { try { const a = await authz.requirePermission(request, "windows_agent.read"); const value = await nodes.node(request.params.id, a.organizationId); return value ? reply.send(value) : reply.code(404).send({ code: "NOT_FOUND" }); } catch (e) { return fail(reply, e); } }
async function getCapabilities(request, reply) { try { const a = await authz.requirePermission(request, "windows_agent.read"); const value = await nodes.capabilities(request.params.id, a.organizationId); return value ? reply.send(value) : reply.code(404).send({ code: "NOT_FOUND" }); } catch (e) { return fail(reply, e); } }
async function revokeNode(request, reply) { try { const a = await authz.requirePermission(request, "windows_agent.manage"); const value = await nodes.revoke(request.params.id, a.organizationId, a.userId); return value ? reply.send(value) : reply.code(404).send({ code: "NOT_FOUND" }); } catch (e) { return fail(reply, e); } }
async function createSession(request, reply) { try { const a = await authz.requirePermission(request, "windows_session.create"); const n = await nodes.node(request.params.id, a.organizationId); if (!n) return reply.code(404).send({ code: "NOT_FOUND" }); return reply.code(201).send(await sessions.createSession({ ...request.body, windows_node_id: n.windows_node_id, organization_id: a.organizationId, requested_by: a.userId })); } catch (e) { return fail(reply, e); } }
async function getSession(request, reply) { try { const a = await authz.requirePermission(request, "windows_agent.read"); const s = await sessions.session(request.params.id, a.organizationId); return s ? reply.send(s) : reply.code(404).send({ code: "NOT_FOUND" }); } catch (e) { return fail(reply, e); } }
async function command(request, reply) { try { const a = await authz.requirePermission(request, request.params.action === "inspect" ? "windows_session.inspect" : "windows_session.control"); const s = await sessions.session(request.params.id, a.organizationId); if (!s) return reply.code(404).send({ code: "NOT_FOUND" }); const type = mapActionToCommandType(request.params.action, request.body.payload || request.body); if (!type) return reply.code(400).send({ code: "COMMAND_NOT_ALLOWED", message: "Unsupported Windows command action" }); return reply.code(202).send(await sessions.issueCommand(s, type, request.body.payload || request.body, a.userId, request.headers["idempotency-key"])); } catch (e) { return fail(reply, e); } }
async function sessionEvidence(request, reply) { try { const a = await authz.requirePermission(request, "windows_evidence.read"); return reply.send(await sessions.evidence(request.params.id, a.organizationId)); } catch (e) { return fail(reply, e); } }
async function profileCrud(request, reply) { try { const a = await authz.requirePermission(request, "windows_application_profile.manage"); if (request.method === "GET") return reply.send(request.params.id ? await profiles.profile(request.params.id, a.organizationId) : await profiles.list(a.organizationId)); if (request.method === "POST") return reply.code(201).send(await profiles.create({ ...request.body, organization_id: a.organizationId }, a.userId)); if (request.method === "PUT") return reply.send(await profiles.update(request.params.id, a.organizationId, request.body, a.userId)); return reply.send(await profiles.remove(request.params.id, a.organizationId, a.userId)); } catch (e) { return fail(reply, e); } }
async function evidenceContent(request, reply) { try { const a = await authz.requirePermission(request, "windows_evidence.read"); const item = await evidence.evidence(request.params.id, a.organizationId); if (!item) return reply.code(404).send({ code: "NOT_FOUND" }); const storageUrl = `${process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092"}/storage/internal/files/${item.storage_file_id}/content`; const upstream = await axios.get(storageUrl, { responseType: "stream", headers: { authorization: `Bearer ${getInternalApiToken()}` } }); reply.header("content-type", item.content_type || "application/octet-stream"); reply.header("content-disposition", `attachment; filename="${item.filename || item.execution_evidence_id}"`); return reply.send(upstream.data); } catch (e) { return fail(reply, e); } }
async function bootstrapPermissions(request, reply) {
  try {
    let organizationId;
    const assignToRoleName = request.body?.assignToRoleName || "Super Admin";
    let usedInternal = false;
    try {
      assertInternal(request);
      usedInternal = true;
      organizationId = Number(request.body?.organization_id);
      if (!Number.isInteger(organizationId) || organizationId <= 0) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "organization_id is required for internal bootstrap",
        });
      }
    } catch (_) {
      const actor = authz.principal(request);
      organizationId = actor.organizationId;
      const { db } = require("../database/mysql/factories/windows-w1-factory");
      const roles = await db.sequelize.query(
        `SELECT r.name FROM user_role ur
         JOIN role r ON r.role_id = ur.role_id AND r.organization_id = ur.organization_id
         WHERE ur.user_id = :userId AND ur.organization_id = :organizationId
           AND r.deleted_date IS NULL AND ur.deleted_date IS NULL`,
        {
          replacements: { userId: Number(actor.userId), organizationId: actor.organizationId },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );
      const names = roles.map((row) => row.name);
      if (!names.includes("Super Admin") && !names.includes(assignToRoleName)) {
        await authz.requirePermission(request, "windows_agent.manage");
      }
    }
    return reply.send(
      await ensurePermissionsForOrganization(organizationId, { assignToRoleName })
    );
  } catch (e) {
    return fail(reply, e);
  }
}
async function agentUpdate(request, reply) {
  try {
    assertInternal(request);
    const { agent_id, organization_id, capabilities, health, command_ack, command_result } = request.body;
    if (capabilities) {
      await model("AgentCapability").destroy({ where: { agent_id } });
      await model("AgentCapability").bulkCreate(
        capabilities.map((x) => ({
          capability: x.capability || x.command_type || x.name,
          details: x,
          agent_id,
          organization_id,
        }))
      );
    }
    if (health) {
      await model("AgentHealth").create({
        ...health,
        agent_id,
        organization_id,
        observed_at: new Date(),
      });
      const status = health.status === "ONLINE" || health.status === "READY" ? health.status : health.status;
      await model("WindowsNode").update(
        { status: status || "ONLINE", last_seen_at: new Date() },
        { where: { agent_id, organization_id } }
      );
    }
    if (command_ack) {
      const commandId = command_ack.execution_command_id || command_ack.request_id;
      if (!commandId) {
        throw Object.assign(new Error("Command acknowledgement correlation id is required"), {
          code: "COMMAND_ACK_INVALID",
          statusCode: 400,
        });
      }
      await model("ExecutionCommand").update(
        { status: COMMAND_STATES.ACKNOWLEDGED },
        { where: { execution_command_id: commandId, organization_id, agent_id } }
      );
    }
    if (command_result) {
      const resultPayload = command_result.result || command_result;
      const commandId = command_result.execution_command_id || resultPayload.RequestId || resultPayload.requestId;
      if (!commandId) {
        throw Object.assign(new Error("Command result correlation id is required"), {
          code: "COMMAND_RESULT_INVALID",
          statusCode: 400,
        });
      }
      await model("ExecutionCommandResult").findOrCreate({
        where: { execution_command_id: commandId, organization_id },
        defaults: {
          execution_command_id: commandId,
          organization_id,
          status: command_result.status || (resultPayload.Success ? "RESULT_RECEIVED" : "FAILED"),
          result: resultPayload,
          received_at: new Date(),
          created_by: agent_id,
        },
      });
      await model("ExecutionCommand").update({
        result: resultPayload,
        result_received_at: new Date(),
      }, { where: { execution_command_id: commandId, organization_id } });
      if (commandId) {
        const success =
          resultPayload.Success !== false &&
          String(command_result.status || "").toUpperCase() !== "FAILED";
        await reconcileCommandCompletion(commandId, organization_id, {
          resultPayload,
          success,
          actor: agent_id,
        });
      }
    }
    return reply.send({ ok: true });
  } catch (e) {
    return fail(reply, e);
  }
}
async function getCommand(request, reply) {
  try {
    const a = await authz.requirePermission(request, "windows_agent.read");
    const value = await sessions.commandWithManifest(request.params.id, a.organizationId);
    return value ? reply.send(value) : reply.code(404).send({ code: "NOT_FOUND" });
  } catch (e) {
    return fail(reply, e);
  }
}
async function getAgentInternal(request, reply) { try { assertInternal(request); const value = await model("AgentIdentity").findOne({ where: { agent_id: request.params.id, deleted_date: null } }); return value ? reply.send(value) : reply.code(404).send({ code: "NOT_FOUND" }); } catch (e) { return fail(reply, e); } }
module.exports = { createEnrollment, enrollAgent, listNodes, getNode, getCapabilities, revokeNode, createSession, getSession, command, sessionEvidence, profileCrud, evidenceContent, bootstrapPermissions, agentUpdate, getAgentInternal, getCommand, COMMAND_STATES };
