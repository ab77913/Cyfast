"use strict";

const {
  FAILURE_CLASSIFICATION,
  isAutomationRepairEligible,
} = require("./failure-classifier");

const FORBIDDEN_REPAIR_PATTERNS = Object.freeze([
  /remove\s+(?:the\s+)?assert/i,
  /delete\s+(?:the\s+)?assert/i,
  /skip\s+(?:the\s+)?(?:step|test|assert)/i,
  /convert\s+(?:the\s+)?(?:failure|assertion)\s+to\s+(?:warning|log)/i,
  /mark\s+(?:the\s+)?(?:test|execution)\s+pass/i,
  /ignore\s+(?:the\s+)?(?:failure|error|assertion)/i,
  /replace\s+.+\s+with\s+(?:log|no operation|noop)/i,
  /arbitrary\s+(?:shell|powershell|cmd)/i,
]);

class RepairPolicyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RepairPolicyError";
    this.code = code;
    this.details = details;
  }
}

function normalizeAttempts(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function evaluateRepairEligibility(input = {}, policy = {}) {
  const maxAttempts = Number.isSafeInteger(Number(policy.maxAttempts))
    ? Math.max(0, Math.min(Number(policy.maxAttempts), 10))
    : 3;
  const repairAttempts = normalizeAttempts(input.repairAttempts);
  const classification = String(input.classification || FAILURE_CLASSIFICATION.UNKNOWN);

  if (!isAutomationRepairEligible(classification)) {
    return Object.freeze({
      eligible: false,
      reason: "FAILURE_CLASSIFICATION_NOT_REPAIRABLE",
      classification,
      repairAttempts,
      maxAttempts,
    });
  }
  if (repairAttempts >= maxAttempts) {
    return Object.freeze({
      eligible: false,
      reason: "MAX_REPAIR_ATTEMPTS_REACHED",
      classification,
      repairAttempts,
      maxAttempts,
    });
  }
  if (input.approvalRequired === true && input.approved !== true) {
    return Object.freeze({
      eligible: false,
      reason: "REPAIR_APPROVAL_REQUIRED",
      classification,
      repairAttempts,
      maxAttempts,
    });
  }

  return Object.freeze({
    eligible: true,
    reason: null,
    classification,
    repairAttempts,
    nextAttempt: repairAttempts + 1,
    maxAttempts,
  });
}

function assertSafeRepairProposal(proposal = {}) {
  if (!proposal || typeof proposal !== "object") {
    throw new RepairPolicyError("INVALID_REPAIR_PROPOSAL", "Repair proposal is required.");
  }
  if (!proposal.summary || typeof proposal.summary !== "string") {
    throw new RepairPolicyError(
      "REPAIR_SUMMARY_REQUIRED",
      "Repair proposal must explain the automation defect and intended change.",
    );
  }
  if (!proposal.updatedPackage || typeof proposal.updatedPackage !== "object") {
    throw new RepairPolicyError(
      "UPDATED_PACKAGE_REQUIRED",
      "Repair proposal must include a complete updated automation package.",
    );
  }

  const text = [
    proposal.summary,
    proposal.rationale,
    proposal.diff,
    JSON.stringify(proposal.updatedPackage),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 500_000);

  for (const pattern of FORBIDDEN_REPAIR_PATTERNS) {
    if (pattern.test(text)) {
      throw new RepairPolicyError(
        "UNSAFE_REPAIR_PROPOSAL",
        "Repair proposal attempts to weaken test intent or bypass deterministic execution.",
        { pattern: pattern.source },
      );
    }
  }

  const beforeAssertions = Number(proposal.beforeMeaningfulAssertions);
  const afterAssertions = Number(proposal.afterMeaningfulAssertions);
  if (
    Number.isFinite(beforeAssertions) &&
    Number.isFinite(afterAssertions) &&
    afterAssertions < beforeAssertions
  ) {
    throw new RepairPolicyError(
      "ASSERTION_WEAKENING_REJECTED",
      "A repair may not reduce the number of meaningful assertions.",
      { beforeAssertions, afterAssertions },
    );
  }

  const beforeActions = Number(proposal.beforeMeaningfulActions);
  const afterActions = Number(proposal.afterMeaningfulActions);
  if (Number.isFinite(beforeActions) && Number.isFinite(afterActions) && afterActions < beforeActions) {
    throw new RepairPolicyError(
      "BUSINESS_ACTION_REMOVAL_REJECTED",
      "A repair may not remove required business actions.",
      { beforeActions, afterActions },
    );
  }

  return Object.freeze({
    safe: true,
    summary: proposal.summary.trim(),
  });
}

module.exports = {
  FORBIDDEN_REPAIR_PATTERNS,
  RepairPolicyError,
  evaluateRepairEligibility,
  assertSafeRepairProposal,
};
