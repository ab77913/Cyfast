"use strict";
const crypto = require("crypto");
const { model, getById } = require("../../database/mysql/factories/windows-w1-factory");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
async function recordEvidence(data, actor) {
  if (!data.storage_file_id || !data.content_hash) throw new Error("Protected storage file id and content hash are required");
  return model("ExecutionEvidence").create({ ...data, retention_classification: data.retention_classification || "STANDARD", created_by: actor });
}
const evidence = (id, org) => getById("ExecutionEvidence", "execution_evidence_id", id, org);
module.exports = { hash, recordEvidence, evidence };
