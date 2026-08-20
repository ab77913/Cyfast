"use strict";

const axios = require("axios");
const store = require("./execution-store");
const lifecycle = require("./execution-lifecycle-service");
const { createSequelizeScriptRepository } = require("./script-package-hydrator");
const { getInternalApiToken } = require("../windows/windows-security-config");
const { redactSecrets, typedError } = require("./execution-contract");

async function proposeAiRepair(runId, actor) {
  const run = await store.getRun(runId, actor);
  if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
  if (run.status !== "REPAIR_PENDING") throw typedError("REPAIR_NOT_PENDING", `Run is not awaiting repair: ${run.status}`, 409);

  const repository = createSequelizeScriptRepository(store.db);
  const script = await repository.loadScript({
    organizationId: actor.organizationId,
    projectId: actor.projectId,
    testScriptId: run.test_script_id,
  });
  if (!script) throw typedError("TEST_SCRIPT_NOT_FOUND", "Failed run Test Script could not be loaded", 404);

  const [artifacts, events, defects, repairs] = await Promise.all([
    store.listArtifacts(runId, actor, { page: 1, page_size: 100 }),
    store.listEvents(runId, actor, { page: 1, page_size: 100 }),
    store.listDefects(runId, actor, { page: 1, page_size: 100 }),
    store.listRepairAttempts(runId, actor, { page: 1, page_size: 100 }),
  ]);
  const attemptNumber = Number(repairs.pagination.total || 0) + 1;
  if (attemptNumber > 3) throw typedError("REPAIR_ATTEMPT_LIMIT_REACHED", "Maximum of three repair attempts reached", 409);

  const endpoint = aiEngineEndpoint();
  const response = await axios.post(
    `${endpoint}/v1/script_repairs/propose`,
    {
      failure_classification: run.failure_classification,
      attempt_number: attemptNumber,
      platform: run.platform,
      before_script: script.content,
      failure_message: run.failure_message || "Execution failed",
      evidence_summary: redactSecrets({
        artifacts: artifacts.items.map((item) => ({
          type: item.artifact_type,
          filename: item.filename,
          sha256: item.content_hash,
          size: item.size_bytes,
        })),
        recent_events: events.items.slice(-20).map((item) => ({
          sequence_number: item.sequence_number,
          event_type: item.event_type,
          payload: item.payload,
        })),
        defects: defects.items.map((item) => ({
          classification: item.classification,
          expected_result: item.expected_result,
          actual_result: item.actual_result,
        })),
        result_summary: run.result_summary,
      }),
      target_context: redactSecrets({
        runtime_snapshot: run.runtime_snapshot,
        package_manifest: run.package_manifest,
      }),
    },
    {
      headers: {
        authorization: `Bearer ${getInternalApiToken()}`,
        "content-type": "application/json",
        "x-correlation-id": run.correlation_id,
      },
      timeout: 180_000,
      maxContentLength: 4 * 1024 * 1024,
      maxBodyLength: 4 * 1024 * 1024,
    },
  );
  const proposal = response.data || {};
  if (!proposal.proposed_script || !proposal.unified_diff || proposal.validation?.valid !== true) {
    throw typedError("AI_REPAIR_PROPOSAL_INVALID", "AI Engine did not return a valid repair proposal", 502);
  }
  const repair = await lifecycle.proposeRepair(runId, {
    before_script: script.content,
    after_script: proposal.proposed_script,
    proposed_patch: proposal.unified_diff,
    diff_summary: (proposal.changes || []).join(" | "),
    rationale: proposal.rationale,
    model_id: proposal.model,
    auto_approve: false,
  }, actor);
  return {
    repair,
    proposal: {
      proposed_script: proposal.proposed_script,
      unified_diff: proposal.unified_diff,
      rationale: proposal.rationale,
      changes: proposal.changes,
      model: proposal.model,
      validation: proposal.validation,
      approval_required: true,
      automatic_rerun: false,
    },
  };
}

function aiEngineEndpoint() {
  const value = String(process.env.AI_ENGINE_URL || "http://127.0.0.1:8099").replace(/\/$/, "");
  if (!/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]|[A-Za-z0-9.-]+)(?::\d{1,5})?$/i.test(value)) {
    throw typedError("AI_ENGINE_URL_INVALID", "AI_ENGINE_URL must be an absolute HTTP(S) service endpoint without a path", 500);
  }
  return value;
}

module.exports = { proposeAiRepair, aiEngineEndpoint };
