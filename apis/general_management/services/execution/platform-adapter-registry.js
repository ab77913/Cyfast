"use strict";

const { URL } = require("url");
const {
  PLATFORMS,
  validateTarget,
  redactSecrets,
  typedError,
} = require("./execution-contract");

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

const FIXED_PATHS = Object.freeze({
  WINDOWS: { check: "/v1/windows/runtime/check", execute: "/v1/windows/executions", cancel: "/v1/windows/executions/{id}/cancel" },
  LINUX: { check: "/v1/linux/runtime/check", execute: "/v1/linux/executions", cancel: "/v1/linux/executions/{id}/cancel" },
  ANDROID: { check: "/v1/android/runtime/check", execute: "/v1/android/executions", cancel: "/v1/android/executions/{id}/cancel" },
  EMBEDDED: { check: "/v1/embedded/runtime/check", execute: "/v1/embedded/executions", cancel: "/v1/embedded/executions/{id}/cancel" },
});

class PlatformAdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter) {
    if (!adapter || !adapter.platform || typeof adapter.check !== "function" || typeof adapter.execute !== "function") {
      throw typedError("INVALID_ADAPTER", "Adapter must expose platform, check(), and execute()", 500);
    }
    if (this.adapters.has(adapter.platform)) throw typedError("ADAPTER_ALREADY_REGISTERED", `Adapter already registered: ${adapter.platform}`, 409);
    this.adapters.set(adapter.platform, adapter);
    return this;
  }

  get(platform) {
    const key = String(platform || "").toUpperCase();
    const adapter = this.adapters.get(key);
    if (!adapter) throw typedError("ADAPTER_NOT_REGISTERED", `No adapter registered for ${key || "<empty>"}`, 422);
    return adapter;
  }

  list() {
    return [...this.adapters.keys()].sort();
  }
}

class HttpPlatformAdapter {
  constructor({ platform, transport, tokenResolver = defaultTokenResolver, allowInsecureLoopback = true, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!Object.values(PLATFORMS).includes(platform)) throw typedError("INVALID_ADAPTER_PLATFORM", `Invalid adapter platform: ${platform}`, 500);
    if (!transport || typeof transport.request !== "function") throw typedError("INVALID_ADAPTER_TRANSPORT", "Adapter transport.request is required", 500);
    this.platform = platform;
    this.transport = transport;
    this.tokenResolver = tokenResolver;
    this.allowInsecureLoopback = allowInsecureLoopback;
    this.timeoutMs = Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1_000), MAX_TIMEOUT_MS);
  }

  async check(target, context = {}) {
    this.assertTarget(target);
    return this.call(target, "POST", FIXED_PATHS[this.platform].check, {
      target_id: target.execution_target_id || target.id,
      platform: this.platform,
      correlation_id: context.correlation_id,
      required_capabilities: target.capabilities || [],
      configuration: redactSecrets(target.configuration || {}),
    });
  }

  async execute(target, request) {
    this.assertTarget(target);
    validateExecutionRequest(request);
    return this.call(target, "POST", FIXED_PATHS[this.platform].execute, {
      execution_id: request.execution_id,
      correlation_id: request.correlation_id,
      platform: this.platform,
      package: request.package,
      runtime: redactSecrets(request.runtime || {}),
      evidence_policy: request.evidence_policy,
      timeout_seconds: Math.min(Math.max(Number(request.timeout_seconds) || 900, 30), 86_400),
    });
  }

  async cancel(target, externalExecutionId, context = {}) {
    this.assertTarget(target);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(externalExecutionId || ""))) {
      throw typedError("INVALID_EXTERNAL_EXECUTION_ID", "External execution id is invalid", 400);
    }
    const path = FIXED_PATHS[this.platform].cancel.replace("{id}", encodeURIComponent(externalExecutionId));
    return this.call(target, "POST", path, { correlation_id: context.correlation_id });
  }

  assertTarget(target) {
    const validation = validateTarget(target);
    if (!validation.valid) throw typedError("INVALID_EXECUTION_TARGET", validation.errors.join(" | "), 422);
    if (validation.platform !== this.platform) throw typedError("TARGET_PLATFORM_MISMATCH", `Expected ${this.platform}; received ${validation.platform}`, 422);
    validateEndpoint(target.endpoint, this.allowInsecureLoopback);
  }

  async call(target, method, requestPath, data) {
    const endpoint = validateEndpoint(target.endpoint, this.allowInsecureLoopback);
    const token = await this.tokenResolver(target.credential_reference);
    if (!token) throw typedError("TARGET_CREDENTIAL_UNAVAILABLE", `Credential reference is unavailable: ${target.credential_reference || "<empty>"}`, 503);
    const url = new URL(requestPath, endpoint.endsWith("/") ? endpoint : `${endpoint}/`).toString();
    const response = await this.transport.request({
      method,
      url,
      data,
      timeout: this.timeoutMs,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 300,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-cyfast-platform": this.platform,
      },
    });
    return response.data;
  }
}

function createDefaultRegistry({ transport, tokenResolver, allowInsecureLoopback, timeoutMs } = {}) {
  if (!transport) {
    // Lazy require keeps pure unit tests independent from axios module loading.
    transport = require("axios");
  }
  const registry = new PlatformAdapterRegistry();
  for (const platform of Object.values(PLATFORMS)) {
    registry.register(new HttpPlatformAdapter({ platform, transport, tokenResolver, allowInsecureLoopback, timeoutMs }));
  }
  return registry;
}

function validateEndpoint(value, allowInsecureLoopback) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch (_) {
    throw typedError("INVALID_TARGET_ENDPOINT", "Target endpoint must be an absolute HTTP(S) URL", 422);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw typedError("INVALID_TARGET_ENDPOINT", "Only HTTP(S) target endpoints are supported", 422);
  if (parsed.username || parsed.password) throw typedError("INVALID_TARGET_ENDPOINT", "Credentials may not be embedded in the endpoint URL", 422);
  if (parsed.pathname !== "/" && parsed.pathname !== "") throw typedError("INVALID_TARGET_ENDPOINT", "Target endpoint must not include a custom request path", 422);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(allowInsecureLoopback && loopback)) {
    throw typedError("INSECURE_TARGET_ENDPOINT", "HTTPS is required for non-loopback execution targets", 422);
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function validateExecutionRequest(request) {
  if (!request || typeof request !== "object") throw typedError("EXECUTION_REQUEST_REQUIRED", "Execution request is required", 400);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(request.execution_id || ""))) throw typedError("INVALID_EXECUTION_ID", "execution_id is invalid", 400);
  if (!request.package || !Array.isArray(request.package.files) || request.package.files.length < 1) {
    throw typedError("EXECUTION_PACKAGE_REQUIRED", "A hydrated execution package is required", 400);
  }
  if (request.command || request.shell || request.executable) {
    throw typedError("ARBITRARY_EXECUTION_REJECTED", "Execution requests may not select a command, shell, or executable", 400);
  }
}

async function defaultTokenResolver(reference) {
  if (!reference || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(reference)) return null;
  return process.env[reference] || null;
}

module.exports = {
  FIXED_PATHS,
  PlatformAdapterRegistry,
  HttpPlatformAdapter,
  createDefaultRegistry,
  validateEndpoint,
  validateExecutionRequest,
};
