"use strict";

/**
 * Shared Windows Connect security configuration.
 * Production always fails closed when required secrets are missing.
 * Development DEV-ONLY fallbacks require WINDOWS_ALLOW_DEV_SECRETS=true
 * and are refused for non-loopback targets.
 */

function envName() {
  return String(process.env.NODE_ENV || "local").toLowerCase();
}

function isProduction() {
  return envName() === "production" || envName() === "prod";
}

function allowDevSecrets() {
  return !isProduction() && String(process.env.WINDOWS_ALLOW_DEV_SECRETS || "").toLowerCase() === "true";
}

function isLoopbackHost(hostname) {
  if (!hostname) return false;
  let host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  // Node often reports WS peers as IPv4-mapped IPv6 (::ffff:127.0.0.1).
  if (host.startsWith("::ffff:")) host = host.slice(7);
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1"
  );
}

function requireSecret(name, { allowDevFallback = false, devValue = null } = {}) {
  const configured = process.env[name];
  if (configured && String(configured).trim()) return String(configured);
  if (isProduction()) {
    throw Object.assign(new Error(`${name} is required in production`), {
      code: "CONFIGURATION_ERROR",
      statusCode: 500,
    });
  }
  if (allowDevFallback && allowDevSecrets() && devValue) {
    console.warn(`[windows-security] Using development fallback for ${name}; never use in production.`);
    return devValue;
  }
  throw Object.assign(new Error(`${name} must be configured (set WINDOWS_ALLOW_DEV_SECRETS=true only for local loopback development)`), {
    code: "CONFIGURATION_ERROR",
    statusCode: 500,
  });
}

function getInternalApiToken() {
  return requireSecret("WINDOWS_INTERNAL_API_TOKEN", {
    allowDevFallback: true,
    devValue: "DEV-ONLY-WINDOWS-INTERNAL-TOKEN",
  });
}

function getEnrollmentPepper() {
  return requireSecret("WINDOWS_ENROLLMENT_PEPPER", {
    allowDevFallback: true,
    devValue: "DEV-ONLY-WINDOWS-ENROLLMENT-PEPPER",
  });
}

function getAgentGatewayJwtSecret() {
  return requireSecret("AGENT_GATEWAY_JWT_SECRET", {
    allowDevFallback: true,
    devValue: "DEV-ONLY-ROTATE-AGENT-GATEWAY-JWT-SECRET",
  });
}

function assertInternalAuth(authorizationHeader) {
  const expected = `Bearer ${getInternalApiToken()}`;
  if (authorizationHeader !== expected) {
    throw Object.assign(new Error("Internal authentication required"), {
      code: "INTERNAL_AUTH_REQUIRED",
      statusCode: 401,
    });
  }
}

/**
 * Allow plain ws only when flag is on AND the peer host is loopback.
 */
function assertAgentTransportAllowed({ protocol, peerHost, allowInsecureFlag }) {
  const secure = protocol === "https" || protocol === "wss";
  if (secure) return { ok: true, mode: "secure" };
  if (!allowInsecureFlag) {
    throw Object.assign(new Error("Insecure transport rejected: enable WSS or set ALLOW_INSECURE_LOCAL_TRANSPORT=true for loopback only"), {
      code: "INSECURE_TRANSPORT_REJECTED",
      statusCode: 400,
    });
  }
  if (!isLoopbackHost(peerHost)) {
    throw Object.assign(new Error("Insecure transport rejected for non-loopback host"), {
      code: "INSECURE_TRANSPORT_REJECTED",
      statusCode: 400,
    });
  }
  return { ok: true, mode: "insecure-loopback" };
}

module.exports = {
  envName,
  isProduction,
  allowDevSecrets,
  isLoopbackHost,
  requireSecret,
  getInternalApiToken,
  getEnrollmentPepper,
  getAgentGatewayJwtSecret,
  assertInternalAuth,
  assertAgentTransportAllowed,
};
