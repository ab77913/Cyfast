"use strict";
const { model, list, getById } = require("../../database/mysql/factories/windows-w1-factory");
const { writeOutbox } = require("./windows-outbox");
async function nodes(organizationId) { return list("WindowsNode", organizationId); }
async function node(id, organizationId) { return getById("WindowsNode", "windows_node_id", id, organizationId); }
async function revoke(id, organizationId, actor) {
  const value = await node(id, organizationId); if (!value) return null;
  await value.update({ status: "REVOKED", modified_by: actor });
  await model("AgentIdentity").update({ status: "REVOKED", revoked_at: new Date(), modified_by: actor }, { where: { agent_id: value.agent_id, organization_id: organizationId } });
  await writeOutbox({ organization_id: organizationId, event_type: "windows.agent.revoked.v1", aggregate_id: value.agent_id, payload: { agent_id: value.agent_id } });
  return value;
}
async function capabilities(id, organizationId) { const value = await node(id, organizationId); return value ? list("AgentCapability", organizationId, { agent_id: value.agent_id }) : null; }
module.exports = { nodes, node, revoke, capabilities };
