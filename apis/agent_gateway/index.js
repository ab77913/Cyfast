"use strict";
const crypto = require("node:crypto");
const Fastify = require("fastify");
const websocket = require("@fastify/websocket");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { validateCommandEnvelope } = require("../general_management/services/windows/command-envelope");
const { assertAgentTransportAllowed } = require("../general_management/services/windows/windows-security-config");

const app = Fastify({ logger: true, ...(config.https ? { https: config.https } : {}) });
const connections = new Map();
const usedNonces = new Map(); // agentId -> Set of recent nonces (replay protection)
const MAX_MESSAGE_BYTES = Number(process.env.AGENT_GATEWAY_MAX_MESSAGE_BYTES || 1024 * 1024);
const internalHeaders = () => ({ authorization: `Bearer ${config.internalToken}` });
async function agent(agentId) {
  return (
    await axios.get(`${config.gmUrl}/internal/windows/agents/${encodeURIComponent(agentId)}`, {
      headers: internalHeaders(),
    })
  ).data;
}
function verifyProof(publicKeyPem, nonce, signature) {
  const data = Buffer.from(String(nonce), "utf8");
  const sig = Buffer.from(signature, "base64");
  // .NET ECDsa.SignData emits IEEE P1363; Node crypto.sign defaults to DER.
  for (const dsaEncoding of ["ieee-p1363", "der"]) {
    try {
      if (
        crypto.verify("sha256", data, { key: publicKeyPem, dsaEncoding }, sig)
      ) {
        return true;
      }
    } catch (_) {
      /* try next encoding */
    }
  }
  return false;
}
function secureTransport(request) {
  return request.protocol === "https" || request.headers["x-forwarded-proto"] === "https";
}
function peerHost(request, socket) {
  const candidates = [
    request.ip,
    request.headers["x-forwarded-for"],
    socket?._socket?.remoteAddress,
    socket?.remoteAddress,
    socket?.socket?.remoteAddress,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const first = String(value).split(",")[0].trim();
    if (first) return first;
  }
  return "";
}

function getWebSocket(connection) {
  if (!connection) return null;
  if (typeof connection.send === "function" && typeof connection.close === "function") return connection;
  if (connection.socket && typeof connection.socket.send === "function") return connection.socket;
  return connection;
}

function closeWebSocket(connection, code, reason) {
  const ws = getWebSocket(connection);
  try {
    if (ws && typeof ws.close === "function") ws.close(code, reason);
  } catch (_) {
    /* ignore */
  }
}

app.get("/health", async () => ({ ok: true, connected_agents: connections.size }));
app.get("/metrics", async (_r, reply) => reply.type("text/plain").send(`agent_gateway_connected_agents ${connections.size}\n`));
app.post("/v1/enroll", async (request, reply) => {
  const response = await axios.post(`${config.gmUrl}/internal/windows/agents/enroll`, request.body, {
    headers: internalHeaders(),
  });
  return reply.code(201).send(response.data);
});
app.post("/v1/commands/dispatch", async (request, reply) => {
  if (request.headers.authorization !== `Bearer ${config.internalToken}`) {
    return reply.code(401).send({ code: "INTERNAL_AUTH_REQUIRED" });
  }
  const command = validateCommandEnvelope(request.body);
  const connection = connections.get(command.agent_id);
  if (!connection) return reply.code(409).send({ code: "AGENT_OFFLINE" });
  connection.socket.send(JSON.stringify({ type: "command", command }));
  return reply.code(202).send({ accepted: true, correlation_id: command.correlation_id });
});
app.get("/v1/agents", async (request, reply) => {
  if (request.headers.authorization !== `Bearer ${config.internalToken}`) {
    return reply.code(401).send({ code: "INTERNAL_AUTH_REQUIRED" });
  }
  return [...connections.values()].map(({ agent_id, organization_id, connected_at }) => ({
    agent_id,
    organization_id,
    connected_at,
  }));
});

async function registerAgentWebSocket() {
  // Must await plugin registration before declaring websocket:true routes,
  // otherwise Fastify invokes the handler as a normal HTTP route.
  await app.register(websocket);
  app.get("/v1/agents/connect", { websocket: true }, async (connection, request) => {
    const socket = getWebSocket(connection);
    try {
      assertAgentTransportAllowed({
        protocol: secureTransport(request) ? "wss" : "ws",
        peerHost: peerHost(request, socket),
        allowInsecureFlag: config.allowInsecure,
      });
    } catch (error) {
      return closeWebSocket(connection, 1008, error.message);
    }
    const agentId = request.query.agent_id;
    if (!agentId) return closeWebSocket(connection, 1008, "agent_id required");

    // Resolve identity BEFORE challenge so the client's proof cannot race the listener.
    let identity;
    try {
      identity = await agent(agentId);
    } catch (_) {
      return closeWebSocket(connection, 1008, "unknown agent");
    }
    if (!identity?.public_key || identity.status === "REVOKED") {
      return closeWebSocket(connection, 1008, "agent revoked or incomplete");
    }
    if (config.requireClientCert) {
      const peerCert = request.raw?.socket?.getPeerCertificate?.(true);
      if (!peerCert || !peerCert.fingerprint256) {
        return closeWebSocket(connection, 1008, "client certificate required");
      }
      const fingerprint = String(peerCert.fingerprint256).replace(/:/g, "").toLowerCase();
      const subjectCn = String(peerCert.subject?.CN || "").trim();
      if (subjectCn && subjectCn !== agentId) {
        return closeWebSocket(connection, 1008, "client certificate agent mismatch");
      }
      const notAfter = peerCert.valid_to ? Date.parse(peerCert.valid_to) : 0;
      if (notAfter && Date.now() > notAfter) {
        return closeWebSocket(connection, 1008, "client certificate expired");
      }
      try {
        const certs = await axios.get(`${config.gmUrl}/internal/windows/agents/${encodeURIComponent(agentId)}`, {
          headers: internalHeaders(),
        });
        if (!certs.data || certs.data.status === "REVOKED") {
          return closeWebSocket(connection, 1008, "agent revoked");
        }
        socket._clientCertFingerprint = fingerprint;
      } catch (_) {
        return closeWebSocket(connection, 1008, "client certificate mapping failed");
      }
    }

    const nonce = crypto.randomBytes(32).toString("base64url");
    const prior = usedNonces.get(agentId) || new Set();
    usedNonces.set(agentId, prior);
    const timer = setTimeout(() => closeWebSocket(connection, 1008, "authentication timeout"), 30000);
    const onAuthMessage = async (raw) => {
      try {
        if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) throw new Error("message too large");
        const first = JSON.parse(raw.toString());
        if (first.nonce && prior.has(String(first.nonce))) throw new Error("replayed reconnect proof");
        prior.add(nonce);
        if (prior.size > 64) {
          const firstNonce = prior.values().next().value;
          prior.delete(firstNonce);
        }
        const proof = first.signature && verifyProof(identity.public_key, nonce, first.signature);
        let reconnect = false;
        if (first.reconnect_token) {
          try {
            reconnect = jwt.verify(first.reconnect_token, config.jwtSecret).agent_id === agentId;
          } catch (_) {
            reconnect = false;
          }
        }
        if (!proof && !reconnect) throw new Error("invalid authentication");
        clearTimeout(timer);
        const entry = {
          socket,
          agent_id: agentId,
          organization_id: identity.organization_id,
          connected_at: new Date().toISOString(),
        };
        connections.set(agentId, entry);
        socket.send(
          JSON.stringify({
            type: "authenticated",
            reconnect_token: jwt.sign(
              { agent_id: agentId, organization_id: identity.organization_id },
              config.jwtSecret,
              { algorithm: "HS256", expiresIn: `${config.reconnectHours}h` }
            ),
          })
        );
        await axios.post(
          `${config.gmUrl}/internal/windows/agents/update`,
          { agent_id: agentId, organization_id: identity.organization_id, health: { status: "ONLINE" } },
          { headers: internalHeaders() }
        );
        socket.on("message", async (message) => {
          try {
            const event = JSON.parse(message.toString());
            const body = { agent_id: agentId, organization_id: identity.organization_id };
            if (event.type === "heartbeat") body.health = { status: event.status || "ONLINE", details: event.details };
            else if (event.type === "capabilities") body.capabilities = event.capabilities || [];
            else if (event.type === "command_result") body.command_result = event.command_result;
            else return;
            await axios.post(`${config.gmUrl}/internal/windows/agents/update`, body, { headers: internalHeaders() });
          } catch (error) {
            app.log.warn({ err: error, agentId }, "agent event rejected");
          }
        });
        socket.on("close", () => connections.delete(agentId));
      } catch (error) {
        clearTimeout(timer);
        closeWebSocket(connection, 1008, error.message);
      }
    };
    socket.once("message", onAuthMessage);
    socket.send(JSON.stringify({ type: "challenge", nonce }));
  });
}

const ready = registerAgentWebSocket();

async function start() {
  await ready;
  await app.listen({ host: config.host, port: config.port });
}

if (require.main === module) {
  start().catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

module.exports = { app, connections, verifyProof, peerHost, ready };
