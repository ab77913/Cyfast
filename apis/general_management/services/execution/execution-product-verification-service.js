"use strict";

const db = require("../../database/mysql/models");
const linkedRerun = require("./execution-linked-rerun-service");
const productFix = require("./execution-product-fix-service");
const store = require("./execution-store");
const trace = require("./execution-trace-service");
const { typedError } = require("./execution-contract");

async function startVerificationRerun(fixId, input, actor) {
  const fix = await db.ExecutionProductFix.findOne({
    where: {
      execution_product_fix_id: fixId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!fix) throw typedError("PRODUCT_FIX_NOT_FOUND", "Product fix was not found", 404);
  if (fix.review_status !== "APPROVED" || fix.deployment_status !== "DEPLOYED") {
    throw typedError(
      "PRODUCT_FIX_VERIFICATION_NOT_READY",
      "The product fix must be reviewed, approved, and deployed before verification",
      409,
    );
  }
  if (fix.verification_execution_run_id) {
    const existing = await store.getRun(fix.verification_execution_run_id, actor);
    if (existing) return existing;
  }
  const run = await linkedRerun.startLinkedRerun(
    fix.source_execution_run_id,
    {
      idempotency_key: input.idempotency_key,
      correlation_id: input.correlation_id,
      timeout_seconds: input.timeout_seconds,
      runtime: input.runtime,
      evidence_policy: input.evidence_policy,
    },
    actor,
    "PRODUCT_FIX_VERIFICATION",
  );
  await fix.update({
    verification_execution_run_id: run.execution_run_id,
    verification_status: terminalStatus(run.status),
    modified_by: actor.userId,
  });
  await trace.appendTraceLink(run, {
    link_type: "PRODUCT_COMMIT",
    resource_id: fix.commit_sha,
    resource_version: fix.deployment_version || "deployed",
    relationship: "VERIFIES_FIX",
    source_system: "GIT",
    metadata: {
      execution_product_fix_id: fix.execution_product_fix_id,
      execution_defect_id: fix.execution_defect_id,
      deployment_id: fix.deployment_id,
      deployment_environment: fix.deployment_environment,
    },
  }, actor);
  await productFix.synchronizeVerification(run, actor);
  return run;
}

function terminalStatus(status) {
  return {
    PASSED: "PASSED",
    FAILED: "FAILED",
    BLOCKED: "BLOCKED",
    CANCELLED: "CANCELLED",
  }[status] || "RUNNING";
}

module.exports = { startVerificationRerun };
