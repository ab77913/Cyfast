"use strict";

const crypto = require("crypto");
const db = require("../../database/mysql/models");
const store = require("./execution-store");
const trace = require("./execution-trace-service");
const { parsePagination } = store;
const { redactSecrets, typedError } = require("./execution-contract");

const REVIEW_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);
const DEPLOYMENT_STATUSES = new Set(["NOT_DEPLOYED", "DEPLOYING", "DEPLOYED", "FAILED", "ROLLED_BACK"]);
const VERIFICATION_STATUSES = new Set(["NOT_STARTED", "RUNNING", "PASSED", "FAILED", "BLOCKED", "CANCELLED"]);

function model() {
  if (!db.ExecutionProductFix) throw typedError("PRODUCT_FIX_MODEL_UNAVAILABLE", "ExecutionProductFix model is unavailable", 500);
  return db.ExecutionProductFix;
}

async function createProductFix(defectId, input, actor) {
  const defect = await scopedDefect(defectId, actor);
  if (defect.classification !== "PRODUCT_DEFECT") {
    throw typedError(
      "PRODUCT_FIX_NOT_ALLOWED",
      `Defect ${defectId} is classified as ${defect.classification}; script or environment defects must use their own workflow`,
      409,
    );
  }
  const sourceRun = await store.getRun(defect.execution_run_id, actor);
  if (!sourceRun) throw typedError("SOURCE_EXECUTION_NOT_FOUND", "Source execution run was not found", 404);
  const value = normalizeProductFix(input);
  const fix = await model().create({
    execution_product_fix_id: crypto.randomUUID().replace(/-/g, ""),
    organization_id: actor.organizationId,
    project_id: actor.projectId,
    execution_defect_id: defectId,
    source_execution_run_id: sourceRun.execution_run_id,
    root_execution_run_id: sourceRun.root_execution_run_id || sourceRun.execution_run_id,
    repository_url: value.repository_url,
    base_branch: value.base_branch,
    fix_branch: value.fix_branch,
    pull_request_url: value.pull_request_url,
    commit_sha: value.commit_sha,
    change_summary: value.change_summary,
    risk_assessment: value.risk_assessment,
    review_status: "PENDING",
    deployment_status: "NOT_DEPLOYED",
    verification_status: "NOT_STARTED",
    created_by: actor.userId,
  });
  await store.appendEvent(sourceRun, {
    event_type: "execution.product_fix.created.v1",
    actor_type: "USER",
    actor_id: actor.userId,
    payload: {
      execution_product_fix_id: fix.execution_product_fix_id,
      execution_defect_id: defectId,
      repository_url: fix.repository_url,
      fix_branch: fix.fix_branch,
      pull_request_url: fix.pull_request_url,
    },
  });
  return fix;
}

async function reviewProductFix(fixId, input, actor) {
  const fix = await scopedFix(fixId, actor);
  const status = String(input.review_status || "").toUpperCase();
  if (!REVIEW_STATUSES.has(status) || status === "PENDING") {
    throw typedError("PRODUCT_FIX_REVIEW_INVALID", "review_status must be APPROVED or REJECTED", 400);
  }
  if (fix.review_status !== "PENDING") {
    throw typedError("PRODUCT_FIX_ALREADY_REVIEWED", `Product fix review is already ${fix.review_status}`, 409);
  }
  const commitSha = String(input.commit_sha || fix.commit_sha || "").toLowerCase();
  const pullRequestUrl = input.pull_request_url ? safeUrl(input.pull_request_url, "pull_request_url") : fix.pull_request_url;
  if (status === "APPROVED" && !/^[a-f0-9]{40,64}$/.test(commitSha)) {
    throw typedError("PRODUCT_FIX_COMMIT_REQUIRED", "An approved product fix requires a 40-64 character commit SHA", 422);
  }
  await fix.update({
    review_status: status,
    commit_sha: commitSha || null,
    pull_request_url: pullRequestUrl,
    reviewed_by: actor.userId,
    reviewed_at: new Date(),
    modified_by: actor.userId,
    risk_assessment: {
      ...(fix.risk_assessment || {}),
      review_comment: String(input.comment || "").slice(0, 8192),
    },
  });
  const run = await store.getRun(fix.source_execution_run_id, actor);
  if (run) {
    await store.appendEvent(run, {
      event_type: `execution.product_fix.${status.toLowerCase()}.v1`,
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        execution_product_fix_id: fixId,
        commit_sha: fix.commit_sha,
        pull_request_url: fix.pull_request_url,
      },
    });
    if (status === "APPROVED") {
      await trace.appendTraceLink(run, {
        link_type: "PRODUCT_COMMIT",
        resource_id: fix.commit_sha,
        resource_version: "reviewed",
        relationship: "RESOLVED_BY",
        source_system: "GIT",
        metadata: {
          execution_product_fix_id: fixId,
          repository_url: fix.repository_url,
          fix_branch: fix.fix_branch,
          pull_request_url: fix.pull_request_url,
        },
      }, actor);
    }
  }
  return fix;
}

async function updateDeployment(fixId, input, actor) {
  const fix = await scopedFix(fixId, actor);
  if (fix.review_status !== "APPROVED") {
    throw typedError("PRODUCT_FIX_NOT_APPROVED", "Product fix must be reviewed and approved before deployment", 409);
  }
  const status = String(input.deployment_status || "").toUpperCase();
  if (!DEPLOYMENT_STATUSES.has(status) || status === "NOT_DEPLOYED") {
    throw typedError("DEPLOYMENT_STATUS_INVALID", "deployment_status is invalid", 400);
  }
  if (status === "DEPLOYED") {
    for (const field of ["deployment_environment", "deployment_id", "deployment_version"]) {
      if (!String(input[field] || "").trim()) throw typedError("DEPLOYMENT_EVIDENCE_REQUIRED", `${field} is required for DEPLOYED`, 422);
    }
  }
  await fix.update({
    deployment_status: status,
    deployment_environment: input.deployment_environment ? String(input.deployment_environment).slice(0, 255) : fix.deployment_environment,
    deployment_id: input.deployment_id ? String(input.deployment_id).slice(0, 255) : fix.deployment_id,
    deployment_version: input.deployment_version ? String(input.deployment_version).slice(0, 255) : fix.deployment_version,
    deployed_at: status === "DEPLOYED" ? new Date() : fix.deployed_at,
    modified_by: actor.userId,
  });
  const run = await store.getRun(fix.source_execution_run_id, actor);
  if (run) {
    await store.appendEvent(run, {
      event_type: `execution.product_fix.deployment.${status.toLowerCase()}.v1`,
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        execution_product_fix_id: fixId,
        deployment_environment: fix.deployment_environment,
        deployment_id: fix.deployment_id,
        deployment_version: fix.deployment_version,
      },
    });
  }
  return fix;
}

async function linkVerificationRun(fixId, executionRunId, actor) {
  const fix = await scopedFix(fixId, actor);
  if (fix.review_status !== "APPROVED" || fix.deployment_status !== "DEPLOYED") {
    throw typedError(
      "PRODUCT_FIX_VERIFICATION_NOT_READY",
      "Product fix must be approved and deployed before a verification rerun can be linked",
      409,
    );
  }
  const run = await store.getRun(executionRunId, actor);
  if (!run) throw typedError("VERIFICATION_RUN_NOT_FOUND", "Verification execution run was not found", 404);
  if ((run.root_execution_run_id || run.execution_run_id) !== fix.root_execution_run_id) {
    throw typedError(
      "VERIFICATION_RUN_ROOT_MISMATCH",
      "Verification execution must share the original root execution lineage",
      409,
    );
  }
  if (run.execution_run_id === fix.source_execution_run_id) {
    throw typedError("VERIFICATION_RUN_INVALID", "The original failed run cannot be reused as verification", 409);
  }
  const status = verificationStatus(run.status);
  await fix.update({
    verification_execution_run_id: run.execution_run_id,
    verification_status: status,
    modified_by: actor.userId,
  });
  await store.appendEvent(run, {
    event_type: "execution.product_fix.verification.linked.v1",
    actor_type: "USER",
    actor_id: actor.userId,
    payload: {
      execution_product_fix_id: fixId,
      source_execution_run_id: fix.source_execution_run_id,
      commit_sha: fix.commit_sha,
      deployment_version: fix.deployment_version,
    },
  });
  await synchronizeVerification(run, actor);
  return fix.reload();
}

async function synchronizeVerification(run, actor) {
  const value = run.toJSON ? run.toJSON() : run;
  const fix = await model().findOne({
    where: {
      verification_execution_run_id: value.execution_run_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!fix) return null;
  const status = verificationStatus(value.status);
  if (!VERIFICATION_STATUSES.has(status)) return fix;
  await fix.update({ verification_status: status, modified_by: actor.userId || actor.actorId });
  const defect = await scopedDefect(fix.execution_defect_id, actor);
  if (status === "PASSED") {
    await defect.update({
      status: "RESOLVED",
      resolution: `Verified by execution ${value.execution_run_id} after deployment ${fix.deployment_version}`,
      product_fix_commit: fix.commit_sha,
      product_fix_pull_request: fix.pull_request_url,
      product_fix_deployment: fix.deployment_id,
      verification_execution_run_id: value.execution_run_id,
      modified_by: actor.userId || actor.actorId,
    });
  }
  return fix;
}

async function listProductFixes(runId, actor, query = {}) {
  const run = await store.getRun(runId, actor);
  if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
  const pagination = parsePagination(query, { defaultPageSize: 50 });
  const result = await model().findAndCountAll({
    where: {
      root_execution_run_id: run.root_execution_run_id || run.execution_run_id,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
    order: [["created_date", "ASC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });
  const total = Number(result.count || 0);
  return {
    items: result.rows,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      total_pages: Math.max(Math.ceil(total / pagination.pageSize), 1),
    },
  };
}

async function scopedFix(fixId, actor) {
  const fix = await model().findOne({
    where: {
      execution_product_fix_id: fixId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!fix) throw typedError("PRODUCT_FIX_NOT_FOUND", "Product fix was not found", 404);
  return fix;
}

async function scopedDefect(defectId, actor) {
  const defect = await db.ExecutionDefect.findOne({
    where: {
      execution_defect_id: defectId,
      organization_id: actor.organizationId,
      project_id: actor.projectId,
      deleted_date: null,
    },
  });
  if (!defect) throw typedError("EXECUTION_DEFECT_NOT_FOUND", "Execution defect was not found", 404);
  return defect;
}

function normalizeProductFix(input = {}) {
  const repositoryUrl = safeUrl(input.repository_url, "repository_url");
  const baseBranch = safeBranch(input.base_branch, "base_branch");
  const fixBranch = safeBranch(input.fix_branch, "fix_branch");
  if (baseBranch === fixBranch) throw typedError("FIX_BRANCH_INVALID", "fix_branch must differ from base_branch", 422);
  const pullRequestUrl = input.pull_request_url ? safeUrl(input.pull_request_url, "pull_request_url") : null;
  const commitSha = input.commit_sha ? String(input.commit_sha).toLowerCase() : null;
  if (commitSha && !/^[a-f0-9]{40,64}$/.test(commitSha)) throw typedError("COMMIT_SHA_INVALID", "commit_sha must contain 40-64 hexadecimal characters", 422);
  const changeSummary = String(input.change_summary || "").trim();
  if (changeSummary.length < 10 || changeSummary.length > 100_000) throw typedError("CHANGE_SUMMARY_INVALID", "change_summary must contain 10-100,000 characters", 422);
  return {
    repository_url: repositoryUrl,
    base_branch: baseBranch,
    fix_branch: fixBranch,
    pull_request_url: pullRequestUrl,
    commit_sha: commitSha,
    change_summary: changeSummary,
    risk_assessment: redactSecrets(input.risk_assessment || {}),
  };
}

function safeUrl(value, field) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch (_) {
    throw typedError("PRODUCT_FIX_URL_INVALID", `${field} must be an absolute URL`, 422);
  }
  if (!["https:", "ssh:"].includes(url.protocol) || url.username || url.password) {
    throw typedError("PRODUCT_FIX_URL_INVALID", `${field} must use HTTPS/SSH and must not contain credentials`, 422);
  }
  return url.toString();
}

function safeBranch(value, field) {
  const text = String(value || "").trim();
  if (!/^(?!\/|.*\.\.)(?!.*\/\/)(?!.*@\{)(?!.*[~^:?*\[\\])[^\s]{1,255}$/.test(text) || text.endsWith("/") || text.endsWith(".")) {
    throw typedError("PRODUCT_FIX_BRANCH_INVALID", `${field} is not a safe Git branch name`, 422);
  }
  return text;
}

function verificationStatus(runStatus) {
  return {
    CREATED: "NOT_STARTED",
    VALIDATING: "RUNNING",
    READY: "RUNNING",
    DISPATCHING: "RUNNING",
    RUNNING: "RUNNING",
    COLLECTING_EVIDENCE: "RUNNING",
    CLASSIFYING: "RUNNING",
    REPAIR_PENDING: "FAILED",
    PASSED: "PASSED",
    FAILED: "FAILED",
    BLOCKED: "BLOCKED",
    CANCELLED: "CANCELLED",
  }[runStatus] || "RUNNING";
}

module.exports = {
  REVIEW_STATUSES,
  DEPLOYMENT_STATUSES,
  VERIFICATION_STATUSES,
  createProductFix,
  reviewProductFix,
  updateDeployment,
  linkVerificationRun,
  synchronizeVerification,
  listProductFixes,
  normalizeProductFix,
  safeBranch,
  safeUrl,
};
