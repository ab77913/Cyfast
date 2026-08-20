"use strict";

const crypto = require("crypto");

class ArtifactStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ArtifactStoreError";
    this.code = code;
    this.details = details;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(number), maximum));
}

function normalizeServiceUrl(value) {
  let url;
  try {
    url = new URL(String(value || "http://127.0.0.1:8092"));
  } catch {
    throw new ArtifactStoreError("INVALID_STORAGE_URL", "Storage Service URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new ArtifactStoreError(
      "INVALID_STORAGE_URL",
      "Storage Service URL must be HTTP(S) and must not contain credentials.",
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  url.search = "";
  url.hash = "";
  return url;
}

function normalizeEndpoint(value) {
  const endpoint = String(value || "/v1/execution-artifacts");
  if (!endpoint.startsWith("/") || endpoint.startsWith("//") || endpoint.includes("\\")) {
    throw new ArtifactStoreError("INVALID_STORAGE_ENDPOINT", "Storage endpoint must be same-origin.");
  }
  if (endpoint.split("/").some((segment) => segment === "..")) {
    throw new ArtifactStoreError("INVALID_STORAGE_ENDPOINT", "Storage endpoint contains traversal.");
  }
  return endpoint;
}

function validateArtifact(artifact, maximumArtifactBytes) {
  if (!artifact || typeof artifact !== "object") {
    throw new ArtifactStoreError("INVALID_ARTIFACT", "Artifact is required.");
  }
  const type = String(artifact.type || "").trim().toUpperCase();
  const fileName = String(artifact.fileName || "").trim();
  const contentType = String(artifact.contentType || "application/octet-stream").trim();
  const sha256 = String(artifact.sha256 || "").trim().toLowerCase();
  const size = Number(artifact.size);
  if (!type || !/^[A-Z0-9_.:-]{1,128}$/.test(type)) {
    throw new ArtifactStoreError("INVALID_ARTIFACT_TYPE", "Artifact type is invalid.");
  }
  if (!fileName || fileName.length > 512 || /[\\/\0]/.test(fileName)) {
    throw new ArtifactStoreError("INVALID_ARTIFACT_FILE_NAME", "Artifact fileName is unsafe.");
  }
  if (!Number.isSafeInteger(size) || size < 0 || size > maximumArtifactBytes) {
    throw new ArtifactStoreError(
      "INVALID_ARTIFACT_SIZE",
      `Artifact must be no larger than ${maximumArtifactBytes} bytes.`,
    );
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new ArtifactStoreError("INVALID_ARTIFACT_CHECKSUM", "Artifact SHA-256 is invalid.");
  }
  if (typeof artifact.contentBase64 !== "string") {
    throw new ArtifactStoreError(
      "ARTIFACT_CONTENT_REQUIRED",
      "Artifact contentBase64 is required for Storage Service upload.",
    );
  }
  const bytes = Buffer.from(artifact.contentBase64, "base64");
  const canonical = bytes.toString("base64").replace(/=+$/, "");
  const supplied = artifact.contentBase64.replace(/\s+/g, "").replace(/=+$/, "");
  if (canonical !== supplied) {
    throw new ArtifactStoreError("INVALID_ARTIFACT_CONTENT", "Artifact content is not canonical base64.");
  }
  if (bytes.length !== size) {
    throw new ArtifactStoreError("ARTIFACT_SIZE_MISMATCH", "Artifact size does not match its content.");
  }
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) {
    throw new ArtifactStoreError(
      "ARTIFACT_CHECKSUM_MISMATCH",
      "Artifact checksum does not match its content.",
    );
  }
  return { type, fileName, contentType, sha256, size, bytes };
}

class StorageServiceArtifactStore {
  constructor({
    repository,
    serviceUrl = process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092",
    uploadEndpoint = process.env.CYFAST_EXECUTION_ARTIFACT_ENDPOINT || "/v1/execution-artifacts",
    credentialRef = process.env.CYFAST_STORAGE_CREDENTIAL_REF || null,
    credentialResolver = async () => null,
    fetchImpl = globalThis.fetch,
    clock = () => new Date(),
    idGenerator = () => crypto.randomUUID(),
    requestTimeoutMs = 120_000,
    maximumArtifactBytes = 20 * 1024 * 1024,
  } = {}) {
    if (!repository || typeof repository.createArtifact !== "function") {
      throw new TypeError("repository.createArtifact must be available.");
    }
    if (typeof credentialResolver !== "function") throw new TypeError("credentialResolver is required.");
    if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required.");
    this.repository = repository;
    this.serviceUrl = normalizeServiceUrl(serviceUrl);
    this.uploadEndpoint = normalizeEndpoint(uploadEndpoint);
    this.credentialRef = credentialRef;
    this.credentialResolver = credentialResolver;
    this.fetch = fetchImpl;
    this.clock = clock;
    this.idGenerator = idGenerator;
    this.requestTimeoutMs = boundedInteger(requestTimeoutMs, 120_000, 5_000, 300_000);
    this.maximumArtifactBytes = boundedInteger(
      maximumArtifactBytes,
      20 * 1024 * 1024,
      1_024,
      100 * 1024 * 1024,
    );
  }

  async persist({ organizationId, projectId, executionId, attemptNumber, artifact }) {
    if (!organizationId || !projectId || !executionId) {
      throw new ArtifactStoreError(
        "ARTIFACT_SCOPE_REQUIRED",
        "Organization, project, and execution scope are required.",
      );
    }
    const validated = validateArtifact(artifact, this.maximumArtifactBytes);
    const upload = await this._upload({
      organizationId,
      projectId,
      executionId,
      attemptNumber,
      artifact,
      validated,
    });
    const record = await this.repository.createArtifact({
      id: this.idGenerator(),
      organizationId,
      projectId,
      executionId,
      attemptNumber: Math.max(1, Number(attemptNumber) || 1),
      type: validated.type,
      fileName: validated.fileName,
      contentType: validated.contentType,
      size: validated.size,
      sha256: validated.sha256,
      storageReference: String(upload.storageReference || upload.reference || upload.id || ""),
      downloadReference: upload.downloadReference || upload.downloadUrl || null,
      expiresAt: upload.expiresAt || null,
      createdAt: this.clock(),
    });
    if (!record.storageReference) {
      throw new ArtifactStoreError(
        "STORAGE_REFERENCE_MISSING",
        "Storage Service did not return a durable reference.",
      );
    }
    return record;
  }

  async getDownloadReference({ artifactId, organizationId, projectId }) {
    const artifact = await this.repository.getArtifact(artifactId, { organizationId, projectId });
    if (!artifact) {
      throw new ArtifactStoreError("ARTIFACT_NOT_FOUND", "Artifact was not found in this project.");
    }
    if (artifact.expiresAt && new Date(artifact.expiresAt).getTime() <= Date.now()) {
      throw new ArtifactStoreError("ARTIFACT_REFERENCE_EXPIRED", "Artifact download reference has expired.");
    }
    return {
      artifactId: artifact.id,
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      size: artifact.size,
      sha256: artifact.sha256,
      storageReference: artifact.storageReference,
      downloadReference: artifact.downloadReference,
      expiresAt: artifact.expiresAt,
    };
  }

  async _upload({ organizationId, projectId, executionId, attemptNumber, artifact, validated }) {
    const url = new URL(this.uploadEndpoint, this.serviceUrl);
    if (url.origin !== this.serviceUrl.origin) {
      throw new ArtifactStoreError("STORAGE_ORIGIN_MISMATCH", "Storage endpoint changed origin.");
    }
    const token = this.credentialRef
      ? await this.credentialResolver(this.credentialRef)
      : null;
    if (this.credentialRef && (typeof token !== "string" || token.length < 16)) {
      throw new ArtifactStoreError(
        "STORAGE_CREDENTIAL_UNAVAILABLE",
        "Storage Service credential reference could not be resolved.",
      );
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetch(url, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          organizationId,
          projectId,
          executionId,
          attemptNumber,
          type: validated.type,
          fileName: validated.fileName,
          contentType: validated.contentType,
          size: validated.size,
          sha256: validated.sha256,
          contentBase64: artifact.contentBase64,
        }),
      });
      const text = await response.text();
      let payload = {};
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new ArtifactStoreError(
            "INVALID_STORAGE_RESPONSE",
            "Storage Service returned a non-JSON response.",
          );
        }
      }
      if (!response.ok) {
        throw new ArtifactStoreError(
          payload.errorCode || payload.code || `STORAGE_HTTP_${response.status}`,
          payload.message || `Storage Service upload failed with HTTP ${response.status}.`,
          { status: response.status },
        );
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new ArtifactStoreError(
          "ARTIFACT_UPLOAD_TIMEOUT",
          "Storage Service upload exceeded its bounded timeout.",
        );
      }
      if (error instanceof ArtifactStoreError) throw error;
      throw new ArtifactStoreError(
        "ARTIFACT_UPLOAD_FAILED",
        "Storage Service upload failed.",
        { cause: String(error?.message || error) },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = {
  ArtifactStoreError,
  StorageServiceArtifactStore,
  validateArtifact,
};
