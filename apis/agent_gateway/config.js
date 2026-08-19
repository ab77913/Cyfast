"use strict";
const fs = require("node:fs");
const {
  envName,
  getInternalApiToken,
  getAgentGatewayJwtSecret,
} = require("../general_management/services/windows/windows-security-config");

const env = envName();
const internalToken = getInternalApiToken();
const jwtSecret = getAgentGatewayJwtSecret();

function readOptional(pathValue) {
  if (!pathValue) return null;
  return fs.readFileSync(pathValue);
}

function buildHttpsOptions() {
  const keyPath = process.env.AGENT_GATEWAY_TLS_KEY_PATH;
  const certPath = process.env.AGENT_GATEWAY_TLS_CERT_PATH;
  const caPath = process.env.AGENT_GATEWAY_TLS_CA_PATH;
  const requireClientCert = process.env.AGENT_GATEWAY_TLS_REQUIRE_CLIENT_CERT === "true";
  if (!keyPath || !certPath) {
    if (env === "production" || process.env.AGENT_GATEWAY_REQUIRE_TLS === "true") {
      throw Object.assign(
        new Error("Production Agent Gateway requires AGENT_GATEWAY_TLS_KEY_PATH and AGENT_GATEWAY_TLS_CERT_PATH"),
        { code: "CONFIGURATION_ERROR" }
      );
    }
    return null;
  }
  const https = {
    key: readOptional(keyPath),
    cert: readOptional(certPath),
    requestCert: requireClientCert,
    rejectUnauthorized: requireClientCert,
  };
  if (caPath) https.ca = readOptional(caPath);
  return https;
}

module.exports = {
  env,
  host: process.env.AGENT_GATEWAY_HOST || "0.0.0.0",
  port: Number(process.env.AGENT_GATEWAY_PORT || 8094),
  gmUrl: String(process.env.GENERAL_MANAGEMENT_URL || "http://127.0.0.1:8088").trim().replace(/\/$/, ""),
  internalToken,
  jwtSecret,
  reconnectHours: Number(process.env.AGENT_GATEWAY_RECONNECT_HOURS || 4),
  allowInsecure: process.env.ALLOW_INSECURE_LOCAL_TRANSPORT === "true",
  https: buildHttpsOptions(),
  requireClientCert: process.env.AGENT_GATEWAY_TLS_REQUIRE_CLIENT_CERT === "true",
};
