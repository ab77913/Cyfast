"use strict";

const crypto = require("crypto");
const path = require("path");

const PLATFORMS = Object.freeze({
  WINDOWS: "WINDOWS",
  LINUX: "LINUX",
  ANDROID: "ANDROID",
  EMBEDDED: "EMBEDDED",
});

const RUN_STATES = Object.freeze({
  CREATED: "CREATED",
  VALIDATING: "VALIDATING",
  READY: "READY",
  DISPATCHING: "DISPATCHING",
  RUNNING: "RUNNING",
  COLLECTING_EVIDENCE: "COLLECTING_EVIDENCE",
  CLASSIFYING: "CLASSIFYING",
  REPAIR_PENDING: "REPAIR_PENDING",
  BLOCKED: "BLOCKED",
  PASSED: "PASSED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

const TERMINAL_STATES = new Set([
  RUN_STATES.PASSED,
  RUN_STATES.FAILED,
  RUN_STATES.BLOCKED,
  RUN_STATES.CANCELLED,
]);

const TRANSITIONS = Object.freeze({
  CREATED: new Set([RUN_STATES.VALIDATING, RUN_STATES.CANCELLED]),
  VALIDATING: new Set([RUN_STATES.READY, RUN_STATES.BLOCKED, RUN_STATES.FAILED, RUN_STATES.CANCELLED]),
  READY: new Set([RUN_STATES.DISPATCHING, RUN_STATES.CANCELLED]),
  DISPATCHING: new Set([RUN_STATES.RUNNING, RUN_STATES.BLOCKED, RUN_STATES.FAILED, RUN_STATES.CANCELLED]),
  RUNNING: new Set([RUN_STATES.COLLECTING_EVIDENCE, RUN_STATES.BLOCKED, RUN_STATES.FAILED, RUN_STATES.CANCELLED]),
  COLLECTING_EVIDENCE: new Set([RUN_STATES.CLASSIFYING, RUN_STATES.BLOCKED, RUN_STATES.FAILED]),
  CLASSIFYING: new Set([RUN_STATES.PASSED, RUN_STATES.FAILED, RUN_STATES.BLOCKED, RUN_STATES.REPAIR_PENDING]),
  REPAIR_PENDING: new Set([RUN_STATES.VALIDATING, RUN_STATES.FAILED, RUN_STATES.CANCELLED]),
  BLOCKED: new Set([]),
  PASSED: new Set([]),
  FAILED: new Set([]),
  CANCELLED: new Set([]),
});

const FAILURE_CLASSES = Object.freeze({
  LOCATOR_FAILURE: "LOCATOR_FAILURE",
  TIMING_FAILURE: "TIMING_FAILURE",
  ASSERTION_FAILURE: "ASSERTION_FAILURE",
  SCRIPT_DEFECT: "SCRIPT_DEFECT",
  KEYWORD_IMPORT_DEFECT: "KEYWORD_IMPORT_DEFECT",
  TEST_DATA_DEFECT: "TEST_DATA_DEFECT",
  PRODUCT_DEFECT: "PRODUCT_DEFECT",
  ENVIRONMENT_DEFECT: "ENVIRONMENT_DEFECT",
  TARGET_UNAVAILABLE: "TARGET_UNAVAILABLE",
  PERMISSION_FAILURE: "PERMISSION_FAILURE",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  EXECUTION_CANCELLED: "EXECUTION_CANCELLED",
  EVIDENCE_FAILURE: "EVIDENCE_FAILURE",
  UNKNOWN_FAILURE: "UNKNOWN_FAILURE",
});

const REPAIRABLE_FAILURES = new Set([
  FAILURE_CLASSES.LOCATOR_FAILURE,
  FAILURE_CLASSES.TIMING_FAILURE,
  FAILURE_CLASSES.SCRIPT_DEFECT,
  FAILURE_CLASSES.KEYWORD_IMPORT_DEFECT,
]);

const REQUIRED_EVIDENCE_BY_PLATFORM = Object.freeze({
  WINDOWS: ["execution_log", "output_xml", "screenshot", "runtime_proof"],
  LINUX: ["execution_log", "output_xml", "runtime_proof"],
  ANDROID: ["execution_log", "output_xml", "screenshot", "device_log", "runtime_proof"],
  EMBEDDED: ["execution_log", "protocol_trace", "runtime_proof"],
});

function normalizePlatform(value) {
  const platform = String(value || "").trim().toUpperCase();
  if (!Object.values(PLATFORMS).includes(platform)) {
    throw typedError("UNSUPPORTED_PLATFORM", `Unsupported execution platform: ${value || "<empty>"}`, 400);
  }
  return platform;
}

function assertTransition(current, next) {
  if (!Object.values(RUN_STATES).includes(current) || !Object.values(RUN_STATES).includes(next)) {
    throw typedError("INVALID_RUN_STATE", `Unknown state transition ${current} -> ${next}`, 409);
  }
  if (!TRANSITIONS[current].has(next)) {
    throw typedError("INVALID_RUN_TRANSITION", `Run cannot transition from ${current} to ${next}`, 409);
  }
  return next;
}

function isTerminal(state) {
  return TERMINAL_STATES.has(state);
}

function validateTarget(target) {
  if (!target || typeof target !== "object") {
    throw typedError("TARGET_REQUIRED", "Execution target is required", 400);
  }
  const platform = normalizePlatform(target.platform);
  const capabilities = new Set((target.capabilities || []).map((value) => String(value).toLowerCase()));
  const configuration = target.configuration || {};
  const errors = [];

  if (!target.name || String(target.name).trim().length < 2) errors.push("Target name is required");
  if (target.status && !["ONLINE", "READY", "DEGRADED", "OFFLINE", "REVOKED"].includes(String(target.status).toUpperCase())) {
    errors.push("Target status is invalid");
  }
  if (configuration.command || configuration.shell || configuration.powershell || configuration.executable_from_request) {
    errors.push("Arbitrary shell or executable configuration is not permitted");
  }
  if (target.credential && !target.credential_reference) {
    errors.push("Credentials must be stored as a reference, never inline");
  }

  if (platform === PLATFORMS.WINDOWS) {
    requireOne(capabilities, ["windows_robot", "windows_uia", "appium_windows"], errors, "Windows Robot/UIA capability is required");
    if (configuration.interactive_session_required !== false && !capabilities.has("interactive_desktop")) {
      errors.push("Windows target must advertise interactive_desktop");
    }
  } else if (platform === PLATFORMS.LINUX) {
    requireOne(capabilities, ["linux_robot", "pytest", "ssh"], errors, "Linux Robot, pytest, or SSH capability is required");
    if (configuration.transport === "ssh" && !configuration.host) errors.push("SSH host is required");
  } else if (platform === PLATFORMS.ANDROID) {
    requireOne(capabilities, ["android_appium", "adb"], errors, "Android Appium or ADB capability is required");
    if (!configuration.device_id && !configuration.device_selector) errors.push("Android device_id or device_selector is required");
  } else if (platform === PLATFORMS.EMBEDDED) {
    const protocol = String(configuration.protocol || "").toLowerCase();
    const supported = ["can", "lin", "uart", "spi", "i2c", "tcp", "udp", "trdp", "bluetooth", "wifi", "canoe", "capl"];
    if (!supported.includes(protocol)) errors.push("A supported embedded protocol is required");
    if (protocol && !capabilities.has(protocol) && !capabilities.has("embedded_generic")) {
      errors.push(`Target does not advertise ${protocol} capability`);
    }
    if (!configuration.interface_reference && !configuration.bench_reference) {
      errors.push("Embedded interface_reference or bench_reference is required");
    }
  }

  return { valid: errors.length === 0, platform, errors };
}

function validateRealPass(result, options = {}) {
  const platform = normalizePlatform(result?.platform || options.platform);
  const requiredEvidence = options.requiredEvidence || REQUIRED_EVIDENCE_BY_PLATFORM[platform];
  const evidenceTypes = new Set((result?.evidence || []).map((item) => String(item.type || item).toLowerCase()));
  const errors = [];

  if (result?.real_execution !== true) errors.push("real_execution must be true");
  if (result?.simulated !== false) errors.push("simulated must be false");
  if (result?.target_connected !== true) errors.push("A real target connection is required");
  if ([PLATFORMS.WINDOWS, PLATFORMS.ANDROID].includes(platform) && result?.session_created !== true) {
    errors.push("A real automation session is required");
  }
  if (Number(result?.exit_code) !== 0) errors.push("Execution exit_code must be 0");
  if (Number(result?.meaningful_actions || 0) < 1) errors.push("At least one passed meaningful action is required");
  if (Number(result?.meaningful_assertions || 0) < 1) errors.push("At least one passed meaningful assertion is required");
  if (result?.status && String(result.status).toUpperCase() !== "PASSED") errors.push("Runner status must be PASSED");

  for (const type of requiredEvidence) {
    if (!evidenceTypes.has(String(type).toLowerCase())) errors.push(`Missing required evidence: ${type}`);
  }

  return {
    pass: errors.length === 0,
    platform,
    errors,
    proof_hash: sha256(canonicalJson({
      platform,
      real_execution: result?.real_execution,
      simulated: result?.simulated,
      target_connected: result?.target_connected,
      session_created: result?.session_created,
      exit_code: result?.exit_code,
      meaningful_actions: result?.meaningful_actions,
      meaningful_assertions: result?.meaningful_assertions,
      evidence: [...evidenceTypes].sort(),
    })),
  };
}

function classifyFailure(input = {}) {
  if (input.cancelled === true) return FAILURE_CLASSES.EXECUTION_CANCELLED;
  if (input.timed_out === true) return FAILURE_CLASSES.EXECUTION_TIMEOUT;
  if (input.target_connected === false || input.agent_online === false || input.device_connected === false) {
    return FAILURE_CLASSES.TARGET_UNAVAILABLE;
  }
  if (input.permission_denied === true) return FAILURE_CLASSES.PERMISSION_FAILURE;
  if (input.evidence_complete === false && input.execution_succeeded === true) return FAILURE_CLASSES.EVIDENCE_FAILURE;

  const code = String(input.code || input.error_code || "").toUpperCase();
  const text = [input.message, input.stderr, input.stdout, input.failure_message]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (/assertion|should be|expected.*actual|not equal|does not contain|not visible/.test(text) || code.includes("ASSERTION")) {
    return input.product_behavior_confirmed ? FAILURE_CLASSES.PRODUCT_DEFECT : FAILURE_CLASSES.ASSERTION_FAILURE;
  }
  if (/locator|element.*not found|unable to locate|no such element/.test(text) || code.includes("LOCATOR")) {
    return FAILURE_CLASSES.LOCATOR_FAILURE;
  }
  if (/timeout|timed out|wait until/.test(text) || code.includes("TIMEOUT")) return FAILURE_CLASSES.TIMING_FAILURE;
  if (/resource|library|keyword/.test(text) && /not found|failed to import|no keyword/.test(text)) {
    return FAILURE_CLASSES.KEYWORD_IMPORT_DEFECT;
  }
  if (/invalid test data|fixture|dataset|input data/.test(text) || code.includes("TEST_DATA")) {
    return FAILURE_CLASSES.TEST_DATA_DEFECT;
  }
  if (/agent offline|desktop locked|device unauthorized|connection refused|runtime unavailable|driver unavailable/.test(text)) {
    return FAILURE_CLASSES.ENVIRONMENT_DEFECT;
  }
  if (/syntax error|parse error|invalid argument|unknown keyword/.test(text) || code.includes("SCRIPT")) {
    return FAILURE_CLASSES.SCRIPT_DEFECT;
  }
  if (input.product_behavior_confirmed === true || code.includes("PRODUCT_DEFECT")) return FAILURE_CLASSES.PRODUCT_DEFECT;
  return FAILURE_CLASSES.UNKNOWN_FAILURE;
}

function validateRepair({ failure_classification, attempt_number, before_script, after_script, diff_summary }) {
  const errors = [];
  const classification = String(failure_classification || "").toUpperCase();
  if (!REPAIRABLE_FAILURES.has(classification)) errors.push(`Failure ${classification || "<empty>"} is not eligible for automatic script repair`);
  if (!Number.isInteger(attempt_number) || attempt_number < 1 || attempt_number > 3) errors.push("Repair attempt must be between 1 and 3");
  if (!before_script || !after_script) errors.push("Both before_script and after_script are required");

  const beforeAssertions = countAssertions(before_script || "");
  const afterAssertions = countAssertions(after_script || "");
  const beforeActions = countActions(before_script || "");
  const afterActions = countActions(after_script || "");
  if (afterAssertions < beforeAssertions) errors.push("Repair may not remove or weaken assertions");
  if (afterActions < beforeActions) errors.push("Repair may not remove business actions");
  if (/log\s{2,}.*pass|set test variable\s{2,}pass/i.test(after_script || "")) errors.push("Repair may not replace execution with logging or a fabricated PASS");
  if (/\b(?:powershell|cmd\.exe|bash|sh)\b/i.test(diff_summary || "")) errors.push("Repair may not introduce arbitrary shell execution");
  if (/\b(?:password|secret|token|api[_-]?key)\s*[=:]\s*[^%$\s]/i.test(after_script || "")) errors.push("Repair may not introduce plaintext credentials");

  return { valid: errors.length === 0, errors, beforeAssertions, afterAssertions, beforeActions, afterActions };
}

function validatePackagePath(value) {
  if (typeof value !== "string" || !value.trim()) throw typedError("INVALID_PACKAGE_PATH", "Package path is required", 400);
  const normalized = value.replace(/\\/g, "/").trim();
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.startsWith("//")) {
    throw typedError("ABSOLUTE_PATH_REJECTED", `Absolute package path is not allowed: ${value}`, 400);
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw typedError("PATH_TRAVERSAL_REJECTED", `Unsafe package path: ${value}`, 400);
  }
  if (path.posix.normalize(normalized) !== normalized) throw typedError("PATH_NORMALIZATION_REJECTED", `Unsafe package path: ${value}`, 400);
  return normalized;
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = /password|passwd|secret|token|authorization|api[_-]?key|private[_-]?key/i.test(key)
      ? "[REDACTED]"
      : redactSecrets(item);
  }
  return output;
}

function requireOne(capabilities, names, errors, message) {
  if (!names.some((name) => capabilities.has(name))) errors.push(message);
}

function countAssertions(script) {
  return countLines(script, [
    "should be", "should contain", "should equal", "should not", "wait until element is visible",
    "element should", "page should", "status should", "response should", "verify", "assert",
  ]);
}

function countActions(script) {
  return countLines(script, [
    "click", "input text", "press keys", "select from list", "set value", "invoke", "open application",
    "launch application", "tap", "send", "write", "start measurement",
  ]);
}

function countLines(script, keywords) {
  return String(script).split(/\r?\n/).filter((line) => {
    const normalized = line.trim().toLowerCase();
    return normalized && !normalized.startsWith("#") && keywords.some((keyword) => normalized.includes(keyword));
  }).length;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function typedError(code, message, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

module.exports = {
  PLATFORMS,
  RUN_STATES,
  FAILURE_CLASSES,
  REPAIRABLE_FAILURES,
  REQUIRED_EVIDENCE_BY_PLATFORM,
  normalizePlatform,
  assertTransition,
  isTerminal,
  validateTarget,
  validateRealPass,
  classifyFailure,
  validateRepair,
  validatePackagePath,
  redactSecrets,
  canonicalJson,
  sha256,
  typedError,
};
