"use strict";

const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");
const { model, getById } = require("../../database/mysql/factories/windows-w1-factory");
const { getInternalApiToken } = require("./windows-security-config");
const { hash: contentHash } = require("./windows-evidence-service");

const COMMAND_STATES = Object.freeze({
  QUEUED: "QUEUED",
  DISPATCHED: "DISPATCHED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  EXECUTING: "EXECUTING",
  RESULT_RECEIVED: "RESULT_RECEIVED",
  EVIDENCE_PENDING: "EVIDENCE_PENDING",
  EVIDENCE_UPLOADING: "EVIDENCE_UPLOADING",
  EVIDENCE_COMPLETE: "EVIDENCE_COMPLETE",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
  TIMED_OUT: "TIMED_OUT",
  CANCELLED: "CANCELLED",
  EVIDENCE_FAILED: "EVIDENCE_FAILED",
});

const MANDATORY_EVIDENCE = Object.freeze({
  "windows.inspect_ui": ["ui_hierarchy_json", "process_window_metadata", "snapshot_hash"],
  "windows.capture_screenshot": ["screenshot", "screenshot_metadata", "screenshot_hash"],
  "windows.invoke_element": ["action_result_metadata", "resolved_element_metadata", "post_action_ui_snapshot"],
  "windows.set_element_value": ["action_result_metadata", "resolved_element_metadata", "post_action_ui_snapshot"],
  "windows.select_element": ["action_result_metadata", "resolved_element_metadata", "post_action_ui_snapshot"],
  "windows.launch_profile": ["process_application_metadata", "launch_result"],
  "windows.collect_robot_job_result": [
    "robot_output_xml",
    "robot_log_html",
    "robot_report_html",
    "robot_stdout",
    "robot_stderr",
    "robot_execution_proof",
  ],
  "windows.end_session": ["terminal_session_metadata", "cleanup_result"],
});

function requiredEvidenceFor(commandType) {
  return MANDATORY_EVIDENCE[commandType] || [];
}

function newId() {
  return crypto.randomUUID().replace(/-/g, "");
}

async function ensureManifest(command) {
  const existing = await model("WindowsCommandEvidenceManifest").findOne({
    where: { execution_command_id: command.execution_command_id, deleted_date: null },
  });
  if (existing) return existing;
  const required = requiredEvidenceFor(command.command_type);
  return model("WindowsCommandEvidenceManifest").create({
    windows_command_evidence_manifest_id: newId(),
    organization_id: command.organization_id,
    project_id: command.project_id || null,
    execution_command_id: command.execution_command_id,
    interactive_session_id: command.interactive_session_id,
    command_type: command.command_type,
    required_evidence_types: required,
    received_evidence_types: [],
    content_hashes: {},
    upload_attempts: 0,
    status: required.length ? COMMAND_STATES.EVIDENCE_PENDING : COMMAND_STATES.EVIDENCE_COMPLETE,
    created_at: new Date(),
  });
}

function extractEvidenceParts(commandType, resultPayload) {
  const parts = [];
  const payload = resultPayload?.Payload || resultPayload?.payload || resultPayload || {};
  const asObj = typeof payload === "object" && payload !== null ? payload : {};

  if (commandType === "windows.capture_screenshot") {
    const data = asObj.data || asObj.Data;
    const sha = String(asObj.sha256 || asObj.Sha256 || "").toLowerCase();
    if (data) {
      const bytes = Buffer.from(String(data), "base64");
      parts.push({
        type: "screenshot",
        contentType: asObj.contentType || asObj.ContentType || "image/png",
        bytes,
        expectedHash: sha || null,
        filename: `screenshot-${Date.now()}.png`,
      });
      parts.push({
        type: "screenshot_metadata",
        contentType: "application/json",
        bytes: Buffer.from(JSON.stringify({ contentType: asObj.contentType || "image/png", sha256: sha || contentHash(bytes) }), "utf8"),
        filename: `screenshot-meta-${Date.now()}.json`,
      });
      parts.push({
        type: "screenshot_hash",
        contentType: "text/plain",
        bytes: Buffer.from(sha || contentHash(bytes), "utf8"),
        filename: `screenshot-hash-${Date.now()}.txt`,
      });
    }
  }

  if (commandType === "windows.inspect_ui") {
    const tree = asObj.roots || asObj.Roots || asObj.tree || asObj;
    const json = Buffer.from(JSON.stringify(tree), "utf8");
    const sha = contentHash(json);
    parts.push({ type: "ui_hierarchy_json", contentType: "application/json", bytes: json, filename: `ui-tree-${Date.now()}.json` });
    parts.push({
      type: "process_window_metadata",
      contentType: "application/json",
      bytes: Buffer.from(JSON.stringify({ processId: asObj.processId || asObj.ProcessId || null }), "utf8"),
      filename: `ui-meta-${Date.now()}.json`,
    });
    parts.push({ type: "snapshot_hash", contentType: "text/plain", bytes: Buffer.from(sha, "utf8"), filename: `ui-hash-${Date.now()}.txt` });
  }

  if (["windows.invoke_element", "windows.set_element_value", "windows.select_element"].includes(commandType)) {
    const meta = Buffer.from(JSON.stringify({ success: true, payload: asObj }), "utf8");
    parts.push({ type: "action_result_metadata", contentType: "application/json", bytes: meta, filename: `action-${Date.now()}.json` });
    parts.push({
      type: "resolved_element_metadata",
      contentType: "application/json",
      bytes: Buffer.from(JSON.stringify({ automationId: asObj.automationId || null }), "utf8"),
      filename: `element-${Date.now()}.json`,
    });
    parts.push({ type: "post_action_ui_snapshot", contentType: "application/json", bytes: meta, filename: `post-ui-${Date.now()}.json` });
  }

  if (commandType === "windows.launch_profile") {
    const meta = Buffer.from(JSON.stringify(asObj), "utf8");
    parts.push({ type: "process_application_metadata", contentType: "application/json", bytes: meta, filename: `launch-meta-${Date.now()}.json` });
    parts.push({ type: "launch_result", contentType: "application/json", bytes: meta, filename: `launch-result-${Date.now()}.json` });
  }

  if (commandType === "windows.end_session") {
    const meta = Buffer.from(JSON.stringify(asObj || { ended: true }), "utf8");
    parts.push({ type: "terminal_session_metadata", contentType: "application/json", bytes: meta, filename: `end-meta-${Date.now()}.json` });
    parts.push({ type: "cleanup_result", contentType: "application/json", bytes: meta, filename: `cleanup-${Date.now()}.json` });
  }

  if (commandType === "windows.collect_robot_job_result") {
    const artifacts = asObj.artifacts || asObj.Artifacts || [];
    const artifactTypeMap = {
      ROBOT_OUTPUT_XML: "robot_output_xml",
      ROBOT_LOG_HTML: "robot_log_html",
      ROBOT_REPORT_HTML: "robot_report_html",
      STDOUT: "robot_stdout",
      STDERR: "robot_stderr",
    };
    for (const artifact of Array.isArray(artifacts) ? artifacts : []) {
      const sourceType = String(artifact.type || artifact.Type || "").toUpperCase();
      const type = artifactTypeMap[sourceType];
      if (!type) continue;
      const encoded = artifact.contentBase64 || artifact.ContentBase64;
      if (!encoded) continue;
      const bytes = Buffer.from(String(encoded), "base64");
      parts.push({
        type,
        contentType: artifact.contentType || artifact.ContentType || "application/octet-stream",
        bytes,
        expectedHash: String(artifact.sha256 || artifact.Sha256 || "").toLowerCase() || null,
        filename: String(artifact.fileName || artifact.FileName || `${type}-${Date.now()}`),
      });
    }
    const proof = {
      real_execution: asObj.realExecution === true || asObj.RealExecution === true,
      simulated: asObj.simulated === true || asObj.Simulated === true,
      desktop_execution: asObj.desktopExecution === true || asObj.DesktopExecution === true,
      session_created: asObj.sessionCreated === true || asObj.SessionCreated === true,
      robot_exit_code: asObj.robotExitCode ?? asObj.RobotExitCode ?? null,
      meaningful_actions: Number(asObj.meaningfulActions ?? asObj.MeaningfulActions ?? 0),
      meaningful_assertions: Number(asObj.meaningfulAssertions ?? asObj.MeaningfulAssertions ?? 0),
      status: asObj.status || asObj.Status || null,
      runtime_proof_session_id: asObj.runtimeProofSessionId || asObj.RuntimeProofSessionId || null,
      runtime_proof_verified_at: asObj.runtimeProofVerifiedAt || asObj.RuntimeProofVerifiedAt || null,
      started_at: asObj.startedAt || asObj.StartedAt || null,
      finished_at: asObj.finishedAt || asObj.FinishedAt || null,
    };
    parts.push({
      type: "robot_execution_proof",
      contentType: "application/json",
      bytes: Buffer.from(JSON.stringify(proof), "utf8"),
      filename: `robot-proof-${Date.now()}.json`,
    });
  }

  return parts;
}

async function uploadToStorage(bytes, filename, contentType, organizationId) {
  const base = (process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092").replace(/\/$/, "");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const form = new FormData();
      form.append("file", bytes, { filename, contentType });
      form.append("partition_key", `windows-org-${organizationId}`);
      form.append("folder_path", "windows-evidence");
      form.append("uploaded_by", "windows-command-lifecycle");
      const response = await axios.post(`${base}/storage/upload`, form, {
        headers: {
          ...form.getHeaders(),
          authorization: `Bearer ${getInternalApiToken()}`,
          "x-user-id": "windows-lifecycle",
        },
        maxBodyLength: Infinity,
        timeout: 60000,
      });
      const file = response.data?.data?.[0] || response.data?.data || response.data;
      const storageFileId = file?.file_id || file?.id || file?._id;
      if (!storageFileId) throw Object.assign(new Error("Storage upload did not return file id"), { code: "EVIDENCE_UPLOAD_FAILED" });
      return String(storageFileId);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

async function persistEvidencePart(command, part, actor) {
  const computed = contentHash(part.bytes);
  if (part.expectedHash && part.expectedHash.toLowerCase() !== computed.toLowerCase()) {
    throw Object.assign(new Error("Evidence content hash mismatch"), { code: "EVIDENCE_HASH_MISMATCH", statusCode: 400 });
  }
  const existing = await model("ExecutionEvidence").findOne({
    where: {
      organization_id: command.organization_id,
      execution_command_id: command.execution_command_id,
      content_hash: computed,
      deleted_date: null,
    },
  });
  if (existing) return existing;

  const storageFileId = await uploadToStorage(part.bytes, part.filename, part.contentType, command.organization_id);
  return model("ExecutionEvidence").create({
    execution_evidence_id: newId(),
    organization_id: command.organization_id,
    execution_command_id: command.execution_command_id,
    interactive_session_id: command.interactive_session_id,
    storage_file_id: storageFileId,
    content_hash: computed,
    content_type: part.contentType,
    retention_classification: "STANDARD",
    filename: part.filename,
    created_by: actor || "windows-lifecycle",
  });
}

async function reconcileCommandCompletion(commandId, organizationId, { resultPayload, success, actor } = {}) {
  const command = await getById("ExecutionCommand", "execution_command_id", commandId, organizationId);
  if (!command) return null;

  let manifest = await ensureManifest(command);
  const required = requiredEvidenceFor(command.command_type);

  if (success === false) {
    await command.update({ status: COMMAND_STATES.FAILED });
    await manifest.update({ status: COMMAND_STATES.FAILED, failure_reason: "Command execution failed", completed_at: new Date() });
    return { command, manifest, terminal: true };
  }

  await command.update({ status: COMMAND_STATES.RESULT_RECEIVED });

  if (!required.length) {
    await command.update({ status: COMMAND_STATES.COMPLETED });
    await manifest.update({ status: COMMAND_STATES.EVIDENCE_COMPLETE, completed_at: new Date() });
    return { command, manifest, terminal: true };
  }

  await command.update({ status: COMMAND_STATES.EVIDENCE_UPLOADING });
  await manifest.update({
    status: COMMAND_STATES.EVIDENCE_UPLOADING,
    upload_attempts: Number(manifest.upload_attempts || 0) + 1,
  });

  try {
    const parts = extractEvidenceParts(command.command_type, resultPayload);
    const received = new Set(manifest.received_evidence_types || []);
    const hashes = { ...(manifest.content_hashes || {}) };
    for (const part of parts) {
      const row = await persistEvidencePart(command, part, actor);
      received.add(part.type);
      hashes[part.type] = row.content_hash;
    }
    const missing = required.filter((type) => !received.has(type));
    if (missing.length) {
      await command.update({ status: COMMAND_STATES.EVIDENCE_PENDING });
      await manifest.update({
        received_evidence_types: [...received],
        content_hashes: hashes,
        status: COMMAND_STATES.EVIDENCE_PENDING,
        failure_reason: `Missing evidence: ${missing.join(",")}`,
      });
      return { command, manifest, terminal: false, missing };
    }
    await manifest.update({
      received_evidence_types: [...received],
      content_hashes: hashes,
      status: COMMAND_STATES.EVIDENCE_COMPLETE,
      completed_at: new Date(),
      failure_reason: null,
    });
    await command.update({ status: COMMAND_STATES.COMPLETED });
    return { command, manifest, terminal: true };
  } catch (error) {
    await command.update({ status: COMMAND_STATES.EVIDENCE_FAILED });
    await manifest.update({
      status: COMMAND_STATES.EVIDENCE_FAILED,
      failure_reason: error.message,
      completed_at: new Date(),
    });
    throw error;
  }
}

function isTerminalStatus(status) {
  return [
    COMMAND_STATES.COMPLETED,
    COMMAND_STATES.FAILED,
    COMMAND_STATES.TIMED_OUT,
    COMMAND_STATES.CANCELLED,
    COMMAND_STATES.REJECTED,
    COMMAND_STATES.EXPIRED,
    COMMAND_STATES.EVIDENCE_FAILED,
  ].includes(status);
}

module.exports = {
  COMMAND_STATES,
  MANDATORY_EVIDENCE,
  requiredEvidenceFor,
  ensureManifest,
  extractEvidenceParts,
  reconcileCommandCompletion,
  isTerminalStatus,
};
