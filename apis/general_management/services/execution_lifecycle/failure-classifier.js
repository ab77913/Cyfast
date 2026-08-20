"use strict";

const FAILURE_CLASSIFICATION = Object.freeze({
  AUTOMATION_SCRIPT_DEFECT: "AUTOMATION_SCRIPT_DEFECT",
  LOCATOR_FAILURE: "LOCATOR_FAILURE",
  ASSERTION_FAILURE: "ASSERTION_FAILURE",
  KEYWORD_IMPORT_DEFECT: "KEYWORD_IMPORT_DEFECT",
  TEST_DATA_DEFECT: "TEST_DATA_DEFECT",
  PRODUCT_DEFECT: "PRODUCT_DEFECT",
  ENVIRONMENT_DEFECT: "ENVIRONMENT_DEFECT",
  INFRASTRUCTURE_DEFECT: "INFRASTRUCTURE_DEFECT",
  SECURITY_POLICY_FAILURE: "SECURITY_POLICY_FAILURE",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  EXECUTION_CANCELLED: "EXECUTION_CANCELLED",
  UNKNOWN: "UNKNOWN",
});

const CODE_MAP = new Map([
  ["LOCATOR_FAILURE", FAILURE_CLASSIFICATION.LOCATOR_FAILURE],
  ["ELEMENT_NOT_FOUND", FAILURE_CLASSIFICATION.LOCATOR_FAILURE],
  ["APPLICATION_WINDOW_NOT_FOUND", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["APPLICATION_PROCESS_NOT_FOUND", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["APPLICATION_PATH_NOT_FOUND", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["DRIVER_SESSION_FAILED", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["WINAPPDRIVER_NOT_FOUND", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["WINAPPDRIVER_START_FAILED", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["APPIUM_START_FAILED", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["APPIUM_STATUS_FAILED", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["AGENT_NOT_READY", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["BOOTSTRAP_NOT_READY", FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT],
  ["INTERACTIVE_SESSION_LOCKED", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["SESSION_LOCKED", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["NO_INTERACTIVE_SESSION", FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT],
  ["EXECUTION_TIMEOUT", FAILURE_CLASSIFICATION.EXECUTION_TIMEOUT],
  ["EXECUTION_CANCELLED", FAILURE_CLASSIFICATION.EXECUTION_CANCELLED],
  ["KEYWORD_IMPORT_DEFECT", FAILURE_CLASSIFICATION.KEYWORD_IMPORT_DEFECT],
  ["SCRIPT_DEFECT", FAILURE_CLASSIFICATION.AUTOMATION_SCRIPT_DEFECT],
  ["PACKAGE_VALIDATION_FAILED", FAILURE_CLASSIFICATION.AUTOMATION_SCRIPT_DEFECT],
  ["ASSERTION_FAILURE", FAILURE_CLASSIFICATION.ASSERTION_FAILURE],
  ["PERMISSION_DENIED", FAILURE_CLASSIFICATION.SECURITY_POLICY_FAILURE],
  ["UNAUTHORIZED", FAILURE_CLASSIFICATION.SECURITY_POLICY_FAILURE],
]);

const RULES = [
  {
    classification: FAILURE_CLASSIFICATION.LOCATOR_FAILURE,
    pattern: /(element|locator|selector).*(not found|unable to locate|did not match|stale)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.KEYWORD_IMPORT_DEFECT,
    pattern: /(resource|library|keyword).*(not found|failed to import|does not exist|no keyword)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.ASSERTION_FAILURE,
    pattern: /(assert|should).*(failed|not equal|not visible|does not contain|expected)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.TEST_DATA_DEFECT,
    pattern: /(invalid|missing|expired).*(test data|fixture|credential reference|input data)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.PRODUCT_DEFECT,
    pattern: /(application crash|service crash|firmware fault|business rule|unexpected response|incorrect result|product defect)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT,
    pattern: /(desktop locked|device disconnected|application path|window not found|process not found|environment unavailable)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT,
    pattern: /(agent offline|appium|winappdriver|storage unavailable|network unavailable|target unavailable|connection refused)/i,
  },
  {
    classification: FAILURE_CLASSIFICATION.EXECUTION_TIMEOUT,
    pattern: /(timed out|timeout exceeded|deadline exceeded)/i,
  },
];

function normalizeCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function classifyFailure(input = {}) {
  const explicit = normalizeCode(input.failureClassification || input.classification);
  if (explicit && Object.values(FAILURE_CLASSIFICATION).includes(explicit)) {
    return explicit;
  }

  const codes = [input.errorCode, input.code, input.failureCode]
    .map(normalizeCode)
    .filter(Boolean);
  for (const code of codes) {
    if (CODE_MAP.has(code)) return CODE_MAP.get(code);
  }

  const text = [
    input.message,
    input.failureMessage,
    input.stderr,
    input.stdout,
    input.actualResult,
  ]
    .filter((value) => typeof value === "string")
    .join("\n")
    .slice(0, 200_000);

  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.classification;
  }

  if (Number(input.exitCode) !== 0 && Number.isFinite(Number(input.exitCode))) {
    return FAILURE_CLASSIFICATION.AUTOMATION_SCRIPT_DEFECT;
  }
  return FAILURE_CLASSIFICATION.UNKNOWN;
}

function isAutomationRepairEligible(classification) {
  return new Set([
    FAILURE_CLASSIFICATION.AUTOMATION_SCRIPT_DEFECT,
    FAILURE_CLASSIFICATION.LOCATOR_FAILURE,
    FAILURE_CLASSIFICATION.KEYWORD_IMPORT_DEFECT,
  ]).has(classification);
}

function requiresProductDefect(classification) {
  return new Set([
    FAILURE_CLASSIFICATION.PRODUCT_DEFECT,
    FAILURE_CLASSIFICATION.ASSERTION_FAILURE,
  ]).has(classification);
}

function isBlockingEnvironmentFailure(classification) {
  return new Set([
    FAILURE_CLASSIFICATION.ENVIRONMENT_DEFECT,
    FAILURE_CLASSIFICATION.INFRASTRUCTURE_DEFECT,
    FAILURE_CLASSIFICATION.SECURITY_POLICY_FAILURE,
  ]).has(classification);
}

module.exports = {
  FAILURE_CLASSIFICATION,
  classifyFailure,
  isAutomationRepairEligible,
  requiresProductDefect,
  isBlockingEnvironmentFailure,
};
