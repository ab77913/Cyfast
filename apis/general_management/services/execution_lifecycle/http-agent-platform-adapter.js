"use strict";

const TERMINAL_JOB_STATES = new Set(["PASSED", "FAILED", "BLOCKED", "CANCELLED"]);

class HttpAgentAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HttpAgentAdapterError";
    this.code = code;
    this.details = details;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(number), maximum));
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new HttpAgentAdapterError("INVALID_AGENT_URL", "Agent baseUrl must be an absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpAgentAdapterError("INVALID_AGENT_URL", "Agent baseUrl must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new HttpAgentAdapterError(
      "INLINE_AGENT_CREDENTIAL_REJECTED",
      "Agent credentials must not be embedded in the URL.",
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  url.search = "";
  url.hash = "";
  return url;
}

function assertRelativeEndpoint(value, name) {
  const endpoint = String(value || "").trim();
  if (!endpoint.startsWith("/") || endpoint.startsWith("//") || endpoint.includes("\\")) {
    throw new HttpAgentAdapterError(
      "INVALID_AGENT_ENDPOINT",
      `${name} must be a same-origin absolute path.`,
    );
  }
  const segments = endpoint.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new HttpAgentAdapterError("INVALID_AGENT_ENDPOINT", `${name} contains traversal.`);
  }
  return endpoint;
}

function encodeJobId(value) {
  const jobId = String(value || "").trim();
  if (!/^[A-Za-z0-9._:-]{1,256}$/.test(jobId)) {
    throw new HttpAgentAdapterError("INVALID_AGENT_JOB_ID", "Agent returned an invalid job ID.");
  }
  return encodeURIComponent(jobId);
}

function sanitizeTarget(target) {
  if (!target || typeof target !== "object") {
    throw new HttpAgentAdapterError("TARGET_REQUIRED", "Execution target is required.");
  }
  for (const field of ["token", "password", "authorization", "authorizationHeader", "secret"]) {
    if (target[field]) {
      throw new HttpAgentAdapterError(
        "INLINE_AGENT_CREDENTIAL_REJECTED",
        `Target field ${field} is not allowed; use credentialRef.`,
      );
    }
  }
  if (!target.credentialRef) {
    throw new HttpAgentAdapterError(
      "AGENT_CREDENTIAL_REFERENCE_REQUIRED",
      "A server-side agent credentialRef is required.",
    );
  }
  return {
    id: target.id || target.targetId || null,
    baseUrl: normalizeBaseUrl(target.baseUrl || target.endpoint),
    credentialRef: String(target.credentialRef),
    applicationProfileId: target.applicationProfileId || null,
    deviceProfileId: target.deviceProfileId || null,
    capabilities: Array.isArray(target.capabilities) ? target.capabilities : [],
    endpoints: {
      validatePackage: assertRelativeEndpoint(
        target.endpoints?.validatePackage || "/v1/packages/validate",
        "validatePackage endpoint",
      ),
      checkRuntime: assertRelativeEndpoint(
        target.endpoints?.checkRuntime || "/v1/runtime/check",
        "checkRuntime endpoint",
      ),
      recoverRuntime: assertRelativeEndpoint(
        target.endpoints?.recoverRuntime || "/v1/runtime/recover",
        "recoverRuntime endpoint",
      ),
      jobs: assertRelativeEndpoint(target.endpoints?.jobs || "/v1/jobs", "jobs endpoint"),
    },
    requestTimeoutMs: boundedInteger(target.requestTimeoutMs, 30_000, 5_000, 120_000),
    pollIntervalMs: boundedInteger(target.pollIntervalMs, 1_000, 250, 10_000),
    executionTimeoutMs: boundedInteger(
      target.executionTimeoutMs,
      30 * 60 * 1000,
      30_000,
      24 * 60 * 60 * 1000,
    ),
  };
}

class HttpAgentPlatformAdapter {
  constructor({
    target,
    platform,
    fetchImpl = globalThis.fetch,
    credentialResolver,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    maximumResponseBytes = 32 * 1024 * 1024,
  } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function.");
    if (typeof credentialResolver !== "function") {
      throw new TypeError("credentialResolver must be a function.");
    }
    this.target = sanitizeTarget(target);
    this.platform = String(platform || "").trim().toUpperCase();
    this.fetch = fetchImpl;
    this.credentialResolver = credentialResolver;
    this.sleep = sleep;
    this.maximumResponseBytes = boundedInteger(maximumResponseBytes, 32 * 1024 * 1024, 1024, 64 * 1024 * 1024);
    this.activeJobs = new Map();
  }

  async validatePackage({ execution, package: packagePayload, attemptNumber }) {
    return this._request("POST", this.target.endpoints.validatePackage, {
      executionId: execution.id,
      attemptNumber,
      platform: this.platform,
      package: packagePayload,
      applicationProfileId: this.target.applicationProfileId,
      deviceProfileId: this.target.deviceProfileId,
    });
  }

  async checkRuntime({ execution, attemptNumber }) {
    return this._request("POST", this.target.endpoints.checkRuntime, {
      executionId: execution.id,
      attemptNumber,
      platform: this.platform,
      targetId: this.target.id,
      applicationProfileId: this.target.applicationProfileId,
      deviceProfileId: this.target.deviceProfileId,
    });
  }

  async recoverRuntime({ execution, attemptNumber, runtimeProof }) {
    return this._request("POST", this.target.endpoints.recoverRuntime, {
      executionId: execution.id,
      attemptNumber,
      platform: this.platform,
      targetId: this.target.id,
      applicationProfileId: this.target.applicationProfileId,
      deviceProfileId: this.target.deviceProfileId,
      previousRuntimeProof: runtimeProof,
    }, { timeoutMs: Math.max(this.target.requestTimeoutMs, 120_000) });
  }

  async execute({ execution, package: packagePayload, runtimeProof, attemptNumber, onEvent }) {
    const start = await this._request("POST", this.target.endpoints.jobs, {
      executionId: execution.id,
      attemptNumber,
      platform: this.platform,
      targetId: this.target.id,
      package: packagePayload,
      runtimeProof,
      applicationProfileId: this.target.applicationProfileId,
      deviceProfileId: this.target.deviceProfileId,
    }, { timeoutMs: Math.max(this.target.requestTimeoutMs, 60_000) });

    const jobId = start.jobId || start.id;
    const encodedJobId = encodeJobId(jobId);
    this.activeJobs.set(execution.id, jobId);
    const deadline = Date.now() + this.target.executionTimeoutMs;
    let previousStatus = null;

    try {
      while (Date.now() < deadline) {
        const status = await this._request(
          "GET",
          `${this.target.endpoints.jobs}/${encodedJobId}`,
          undefined,
        );
        const normalizedStatus = String(status.status || "UNKNOWN").trim().toUpperCase();
        if (normalizedStatus !== previousStatus && typeof onEvent === "function") {
          await onEvent("AGENT_JOB_STATUS_CHANGED", {
            jobId,
            previousStatus,
            status: normalizedStatus,
            progress: status.progress,
            phase: status.phase,
          });
        }
        previousStatus = normalizedStatus;
        if (TERMINAL_JOB_STATES.has(normalizedStatus)) {
          const result = await this._request(
            "GET",
            `${this.target.endpoints.jobs}/${encodedJobId}/result`,
            undefined,
            { timeoutMs: Math.max(this.target.requestTimeoutMs, 120_000) },
          );
          return {
            ...result,
            status: normalizedStatus,
            agentJobId: jobId,
            platform: result.platform || this.platform,
          };
        }
        await this.sleep(this.target.pollIntervalMs);
      }
      const error = new HttpAgentAdapterError(
        "EXECUTION_TIMEOUT",
        "Real target execution exceeded its configured timeout.",
        { jobId, executionTimeoutMs: this.target.executionTimeoutMs },
      );
      error.exitCode = 1;
      throw error;
    } finally {
      this.activeJobs.delete(execution.id);
    }
  }

  async cancel({ executionId }) {
    const jobId = this.activeJobs.get(executionId);
    if (!jobId) return { accepted: false, reason: "NO_ACTIVE_AGENT_JOB" };
    const encodedJobId = encodeJobId(jobId);
    return this._request(
      "DELETE",
      `${this.target.endpoints.jobs}/${encodedJobId}`,
      undefined,
    );
  }

  async _request(method, endpoint, body, options = {}) {
    const token = await this.credentialResolver(this.target.credentialRef);
    if (typeof token !== "string" || token.length < 16) {
      throw new HttpAgentAdapterError(
        "AGENT_CREDENTIAL_UNAVAILABLE",
        "The server-side agent credential reference could not be resolved.",
      );
    }
    const url = new URL(assertRelativeEndpoint(endpoint, "agent endpoint"), this.target.baseUrl);
    if (url.origin !== this.target.baseUrl.origin) {
      throw new HttpAgentAdapterError("AGENT_ENDPOINT_ORIGIN_MISMATCH", "Agent endpoint changed origin.");
    }

    const timeoutMs = boundedInteger(
      options.timeoutMs,
      this.target.requestTimeoutMs,
      1_000,
      180_000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetch(url, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > this.maximumResponseBytes) {
        throw new HttpAgentAdapterError(
          "AGENT_RESPONSE_TOO_LARGE",
          "Agent response exceeded the configured safety limit.",
        );
      }
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > this.maximumResponseBytes) {
        throw new HttpAgentAdapterError(
          "AGENT_RESPONSE_TOO_LARGE",
          "Agent response exceeded the configured safety limit.",
        );
      }
      let payload = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new HttpAgentAdapterError(
            "INVALID_AGENT_RESPONSE",
            "Agent returned a non-JSON response.",
          );
        }
      }
      if (!response.ok) {
        throw new HttpAgentAdapterError(
          payload.errorCode || payload.code || `AGENT_HTTP_${response.status}`,
          payload.message || `Agent request failed with HTTP ${response.status}.`,
          { status: response.status },
        );
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new HttpAgentAdapterError(
          "AGENT_REQUEST_TIMEOUT",
          "Agent request exceeded its bounded timeout.",
          { timeoutMs },
        );
      }
      if (error instanceof HttpAgentAdapterError) throw error;
      throw new HttpAgentAdapterError(
        "AGENT_TRANSPORT_UNAVAILABLE",
        "The real execution agent is unavailable.",
        { cause: String(error?.message || error) },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createHttpAgentFactory(options = {}) {
  return async ({ target, platform }) => new HttpAgentPlatformAdapter({
    ...options,
    target,
    platform,
  });
}

module.exports = {
  TERMINAL_JOB_STATES,
  HttpAgentAdapterError,
  HttpAgentPlatformAdapter,
  createHttpAgentFactory,
  sanitizeTarget,
};
