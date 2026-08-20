"use strict";

const axios = require("axios");
const FormData = require("form-data");
const { getInternalApiToken } = require("../windows/windows-security-config");
const store = require("./execution-store");
const {
  REQUIRED_EVIDENCE_BY_PLATFORM,
  normalizePlatform,
  sha256,
  redactSecrets,
  typedError,
} = require("./execution-contract");

const MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
const RECORDING_TYPES = new Set(["screen_recording", "video_recording", "semantic_recording", "protocol_recording"]);

async function ingestArtifacts(run, artifacts, actor, options = {}) {
  const required = new Set((options.requiredEvidence || REQUIRED_EVIDENCE_BY_PLATFORM[normalizePlatform(run.platform)]).map(normalizeType));
  const persisted = [];
  const failures = [];

  for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
    try {
      const row = await persistArtifact(run, artifact, actor, options);
      persisted.push(row);
      if (RECORDING_TYPES.has(normalizeType(row.artifact_type))) {
        await persistRecording(run, row, artifact, actor);
      }
    } catch (error) {
      failures.push({
        artifact_type: normalizeType(artifact?.type || artifact?.artifact_type || "unknown"),
        code: error.code || "ARTIFACT_PERSISTENCE_FAILED",
        message: error.message,
        mandatory: required.has(normalizeType(artifact?.type || artifact?.artifact_type)),
      });
    }
  }

  const received = new Set(persisted.map((item) => normalizeType(item.artifact_type)));
  const missing = [...required].filter((type) => !received.has(type));
  return {
    persisted,
    failures,
    received: [...received].sort(),
    missing,
    complete: missing.length === 0,
  };
}

async function persistArtifact(run, input, actor, options = {}) {
  const normalized = normalizeArtifact(input);
  let storageFileId = normalized.storage_file_id;
  let contentHash = normalized.content_hash;
  let sizeBytes = normalized.size_bytes;

  if (normalized.content_base64) {
    const bytes = decodeBase64(normalized.content_base64);
    sizeBytes = bytes.length;
    contentHash = sha256(bytes);
    if (normalized.content_hash && contentHash !== normalized.content_hash.toLowerCase()) {
      throw typedError("ARTIFACT_HASH_MISMATCH", `Checksum mismatch for ${normalized.filename}`, 422);
    }
    storageFileId = await uploadToStorage({
      bytes,
      filename: normalized.filename,
      contentType: normalized.content_type,
      organizationId: run.organization_id,
      projectId: run.project_id,
      runId: run.execution_run_id,
      timeoutMs: options.storageTimeoutMs,
    });
  } else if (storageFileId) {
    const metadata = await fetchStorageMetadata(storageFileId, options.storageTimeoutMs);
    const remoteHash = String(metadata.content_hash || metadata.sha256 || metadata.checksum || "").toLowerCase();
    const remoteSize = Number(metadata.size || metadata.size_bytes || metadata.file_size || 0);
    if (contentHash && remoteHash && contentHash !== remoteHash) throw typedError("ARTIFACT_HASH_MISMATCH", `Stored artifact checksum mismatch: ${normalized.filename}`, 422);
    if (sizeBytes && remoteSize && Number(sizeBytes) !== remoteSize) throw typedError("ARTIFACT_SIZE_MISMATCH", `Stored artifact size mismatch: ${normalized.filename}`, 422);
    contentHash = contentHash || remoteHash;
    sizeBytes = sizeBytes || remoteSize;
  } else {
    throw typedError("ARTIFACT_CONTENT_REQUIRED", `Artifact ${normalized.filename} needs content_base64 or storage_file_id`, 422);
  }

  if (!contentHash || !/^[a-f0-9]{64}$/.test(contentHash)) throw typedError("ARTIFACT_HASH_REQUIRED", `A valid SHA-256 is required for ${normalized.filename}`, 422);
  if (!Number.isSafeInteger(Number(sizeBytes)) || Number(sizeBytes) < 0 || Number(sizeBytes) > MAX_ARTIFACT_BYTES) {
    throw typedError("ARTIFACT_SIZE_INVALID", `Artifact size is invalid for ${normalized.filename}`, 422);
  }

  return store.appendArtifact(run, {
    artifact_type: normalized.artifact_type,
    storage_file_id: storageFileId,
    filename: normalized.filename,
    content_type: normalized.content_type,
    content_hash: contentHash,
    size_bytes: Number(sizeBytes),
    retention_classification: normalized.retention_classification,
    metadata: normalized.metadata,
    captured_at: normalized.captured_at,
    expires_at: normalized.expires_at,
  }, actor);
}

async function persistRecording(run, artifactRow, source, actor) {
  const metadata = redactSecrets(source.metadata || {});
  const startedAt = parseDate(source.started_at || metadata.started_at || run.started_at || new Date());
  const finishedAt = parseDate(source.finished_at || metadata.finished_at || run.finished_at || new Date());
  if (finishedAt < startedAt) throw typedError("RECORDING_TIME_INVALID", "Recording finish time precedes start time", 422);
  return store.appendRecording(run, {
    execution_artifact_id: artifactRow.execution_artifact_id,
    recording_type: normalizeType(source.type || source.artifact_type),
    format: source.format || extensionOf(source.filename) || "unknown",
    redacted: source.redacted !== false,
    started_at: startedAt,
    finished_at: finishedAt,
    metadata,
  }, actor);
}

async function uploadToStorage({ bytes, filename, contentType, organizationId, projectId, runId, timeoutMs }) {
  const base = storageBaseUrl();
  const form = new FormData();
  form.append("file", bytes, { filename, contentType });
  form.append("partition_key", `execution-org-${organizationId}`);
  form.append("folder_path", `projects/${projectId}/executions/${runId}`);
  form.append("uploaded_by", "platform-execution-lifecycle");
  const response = await axios.post(`${base}/storage/upload`, form, {
    headers: {
      ...form.getHeaders(),
      authorization: `Bearer ${getInternalApiToken()}`,
      "x-user-id": "platform-execution-lifecycle",
      "x-organization-id": String(organizationId),
    },
    maxBodyLength: MAX_ARTIFACT_BYTES + 1024 * 1024,
    maxContentLength: 4 * 1024 * 1024,
    timeout: boundedTimeout(timeoutMs),
  });
  const value = response.data?.data?.[0] || response.data?.data || response.data;
  const id = value?.file_id || value?.id || value?._id;
  if (!id) throw typedError("ARTIFACT_UPLOAD_FAILED", "Storage Service did not return a file id", 502);
  return String(id);
}

async function fetchStorageMetadata(storageFileId, timeoutMs) {
  const base = storageBaseUrl();
  const response = await axios.get(`${base}/storage/files/${encodeURIComponent(storageFileId)}`, {
    headers: { authorization: `Bearer ${getInternalApiToken()}` },
    timeout: boundedTimeout(timeoutMs),
  });
  return response.data?.data || response.data || {};
}

function normalizeArtifact(input = {}) {
  const artifactType = normalizeType(input.type || input.artifact_type);
  if (!artifactType) throw typedError("ARTIFACT_TYPE_REQUIRED", "Artifact type is required", 422);
  const filename = String(input.filename || `${artifactType}-${Date.now()}.bin`).replace(/[\r\n"\\/]/g, "_").slice(0, 255);
  const contentType = String(input.content_type || input.contentType || "application/octet-stream").slice(0, 255);
  return {
    artifact_type: artifactType,
    storage_file_id: input.storage_file_id ? String(input.storage_file_id) : null,
    content_base64: input.content_base64 || input.contentBase64 || null,
    content_hash: input.sha256 ? String(input.sha256).toLowerCase() : input.content_hash ? String(input.content_hash).toLowerCase() : null,
    size_bytes: input.size_bytes ?? input.size ?? null,
    filename,
    content_type: contentType,
    retention_classification: String(input.retention_classification || "STANDARD").toUpperCase(),
    metadata: redactSecrets(input.metadata || {}),
    captured_at: parseDate(input.captured_at || new Date()),
    expires_at: input.expires_at ? parseDate(input.expires_at) : null,
  };
}

function decodeBase64(value) {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw typedError("ARTIFACT_BASE64_INVALID", "Artifact content is not valid base64", 422);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > MAX_ARTIFACT_BYTES) throw typedError("ARTIFACT_TOO_LARGE", `Artifact exceeds ${MAX_ARTIFACT_BYTES} bytes`, 413);
  return bytes;
}

function normalizeType(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function extensionOf(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]{1,16})$/);
  return match ? match[1] : null;
}

function parseDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw typedError("INVALID_ARTIFACT_DATE", "Artifact date is invalid", 422);
  return date;
}

function storageBaseUrl() {
  const value = String(process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092").replace(/\/$/, "");
  if (!/^https?:\/\//i.test(value)) throw typedError("STORAGE_URL_INVALID", "STORAGE_SERVICE_URL must be HTTP(S)", 500);
  return value;
}

function boundedTimeout(value) {
  return Math.min(Math.max(Number(value) || 60_000, 5_000), 120_000);
}

module.exports = {
  MAX_ARTIFACT_BYTES,
  RECORDING_TYPES,
  ingestArtifacts,
  persistArtifact,
  persistRecording,
  normalizeArtifact,
  decodeBase64,
  normalizeType,
};
