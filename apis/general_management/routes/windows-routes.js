"use strict";
const c = require("../controllers/windows-controller");
const { isWindowsAutomationEnabled } = require("../services/windows/feature-flag");
module.exports = async function windowsRoutes(fastify) {
  fastify.addHook("onRequest", async (_request, reply) => { if (!isWindowsAutomationEnabled()) return reply.code(503).send({ code: "FEATURE_DISABLED", message: "Windows automation is disabled" }); });
  fastify.post("/agent_enrollments", c.createEnrollment);
  // Administrative, idempotent per-organization permission provisioning for E2E and setup.
  fastify.post("/windows_permissions/bootstrap", c.bootstrapPermissions);
  fastify.post("/internal/windows/agents/enroll", c.enrollAgent);
  fastify.get("/internal/windows/agents/:id", c.getAgentInternal);
  fastify.post("/internal/windows/agents/update", c.agentUpdate);
  fastify.get("/windows_nodes", c.listNodes);
  fastify.get("/windows_nodes/:id", c.getNode);
  fastify.get("/windows_nodes/:id/capabilities", c.getCapabilities);
  fastify.post("/windows_nodes/:id/revoke", c.revokeNode);
  fastify.post("/windows_nodes/:id/sessions", c.createSession);
  fastify.get("/windows_sessions/:id", c.getSession);
  ["launch", "attach", "inspect", "actions", "screenshots", "end"].forEach((action) => fastify.post(`/windows_sessions/:id/${action}`, (r, p) => {
    const request = Object.create(r);
    const commandAction = { actions: "action", screenshots: "screenshot" }[action] || action;
    request.params = { ...r.params, action: commandAction };
    return c.command(request, p);
  }));
  fastify.get("/windows_sessions/:id/evidence", c.sessionEvidence);
  fastify.get("/windows_commands/:id", c.getCommand);
  fastify.get("/windows_application_profiles", c.profileCrud);
  fastify.post("/windows_application_profiles", c.profileCrud);
  fastify.get("/windows_application_profiles/:id", c.profileCrud);
  fastify.put("/windows_application_profiles/:id", c.profileCrud);
  fastify.delete("/windows_application_profiles/:id", c.profileCrud);
  fastify.get("/windows_evidence/:id/content", c.evidenceContent);
};
