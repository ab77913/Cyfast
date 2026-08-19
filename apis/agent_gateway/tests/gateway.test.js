"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
process.env.WINDOWS_ALLOW_DEV_SECRETS = "true";
const { verifyProof } = require("../index");
const { validateCommandEnvelope } = require("../../general_management/services/windows/command-envelope");
const { assertAgentTransportAllowed } = require("../../general_management/services/windows/windows-security-config");
test("agent ECDSA proof verifies only its challenge", () => {
  const keys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const nonce = "challenge"; const signature = crypto.sign("sha256", Buffer.from(nonce), keys.privateKey).toString("base64");
  assert.equal(verifyProof(keys.publicKey.export({ type: "spki", format: "pem" }), nonce, signature), true);
  assert.equal(verifyProof(keys.publicKey.export({ type: "spki", format: "pem" }), "other", signature), false);
});
test("expired and forbidden gateway commands cannot dispatch", () => {
  assert.throws(
    () =>
      validateCommandEnvelope({
        command_type: "windows.health",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(0).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_EXPIRED" }
  );
  assert.throws(
    () =>
      validateCommandEnvelope({
        command_type: "windows.shell",
        agent_id: "a",
        idempotency_key: "i",
        correlation_id: "c",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        payload: {},
      }),
    { code: "COMMAND_REJECTED" }
  );
});

test("gateway transport security permits only loopback plain websockets", () => {
  assert.equal(
    assertAgentTransportAllowed({ protocol: "ws", peerHost: "::1", allowInsecureFlag: true }).mode,
    "insecure-loopback"
  );
  assert.equal(
    assertAgentTransportAllowed({ protocol: "ws", peerHost: "::ffff:127.0.0.1", allowInsecureFlag: true }).mode,
    "insecure-loopback"
  );
  assert.throws(
    () => assertAgentTransportAllowed({ protocol: "ws", peerHost: "192.168.1.25", allowInsecureFlag: true }),
    { code: "INSECURE_TRANSPORT_REJECTED" }
  );
});
