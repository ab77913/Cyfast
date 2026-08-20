"use strict";

const crypto = require("crypto");

const UI_PLATFORMS = new Set([
  "WINDOWS",
  "WINDOWS_DESKTOP",
  "LINUX_DESKTOP",
  "ANDROID",
  "WEB",
]);

class ExecutionProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ExecutionProofError";
    this.code = code;
    this.details = details;
  }
}

function readBoolean(result, ...names) {
  for (const name of names) {
    if (typeof result?.[name] === "boolean") return result[name];
  }
  return undefined;
}

function readNumber(result, ...names) {
  for (const name of names) {
    const value = Number(result?.[name]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizePlatform(value) {
  return String(value || "").trim().toUpperCase();
}

function validateArtifactMetadata(artifact, index) {
  if (!artifact || typeof artifact !== "object") {
    throw new ExecutionProofError("INVALID_ARTIFACT", `Artifact ${index} is invalid.`);
  }
  if (!artifact.type || !artifact.fileName) {
    throw new ExecutionProofError(
      "INVALID_ARTIFACT",
      `Artifact ${index} must include type and fileName.`,
    );
  }
  const size = Number(artifact.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new ExecutionProofError("INVALID_ARTIFACT_SIZE", `Artifact ${index} has an invalid size.`);
  }
  const sha256 = String(artifact.sha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new ExecutionProofError(
      "INVALID_ARTIFACT_CHECKSUM",
      `Artifact ${index} must include a SHA-256 checksum.`,
    );
  }

  if (typeof artifact.contentBase64 === "string") {
    let bytes;
    try {
      bytes = Buffer.from(artifact.contentBase64, "base64");
    } catch (error) {
      throw new ExecutionProofError(
        "INVALID_ARTIFACT_CONTENT",
        `Artifact ${index} is not valid base64.`,
      );
    }
    if (bytes.length !== size) {
      throw new ExecutionProofError(
        "ARTIFACT_SIZE_MISMATCH",
        `Artifact ${index} size does not match its content.`,
      );
    }
    const actual = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actual !== sha256) {
      throw new ExecutionProofError(
        "ARTIFACT_CHECKSUM_MISMATCH",
        `Artifact ${index} checksum does not match its content.`,
      );
    }
  }
}

function validateRuntimeProof(runtimeProof, options = {}) {
  if (!runtimeProof || typeof runtimeProof !== "object") {
    throw new ExecutionProofError("RUNTIME_PROOF_MISSING", "Runtime proof is required.");
  }
  if (runtimeProof.ready !== true) {
    throw new ExecutionProofError("RUNTIME_NOT_READY", "Runtime proof is not ready.");
  }
  if (runtimeProof.realExecution !== true || runtimeProof.simulated !== false) {
    throw new ExecutionProofError(
      "RUNTIME_NOT_REAL",
      "Runtime proof must represent real, non-simulated execution.",
    );
  }

  const verifiedAtValue =
    runtimeProof.driverSession?.lastVerifiedAt ||
    runtimeProof.lastVerifiedAt ||
    runtimeProof.checkedAt;
  const verifiedAt = new Date(verifiedAtValue);
  if (!Number.isFinite(verifiedAt.getTime())) {
    throw new ExecutionProofError(
      "RUNTIME_PROOF_TIMESTAMP_MISSING",
      "Runtime proof must include a verification timestamp.",
    );
  }

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const maximumAgeMs = Number.isFinite(Number(options.maximumAgeMs))
    ? Number(options.maximumAgeMs)
    : 5 * 60 * 1000;
  const ageMs = now.getTime() - verifiedAt.getTime();
  if (ageMs < -30_000 || ageMs > maximumAgeMs) {
    throw new ExecutionProofError(
      "RUNTIME_PROOF_STALE",
      "Runtime proof is outside the permitted freshness window.",
      { ageMs, maximumAgeMs },
    );
  }

  return {
    verifiedAt: verifiedAt.toISOString(),
    ageMs,
  };
}

function validateExecutionResult(result, options = {}) {
  if (!result || typeof result !== "object") {
    throw new ExecutionProofError("EXECUTION_RESULT_MISSING", "Execution result is required.");
  }

  const platform = normalizePlatform(options.platform || result.platform || result.runtimeOs);
  const realExecution = readBoolean(result, "realExecution", "real_execution");
  const simulated = readBoolean(result, "simulated", "isSimulated", "is_simulated");
  const desktopExecution = readBoolean(result, "desktopExecution", "desktop_execution");
  const sessionCreated = readBoolean(result, "sessionCreated", "session_created");
  const exitCode = readNumber(result, "robotExitCode", "robot_exit_code", "exitCode", "exit_code");
  const actions = readNumber(result, "meaningfulActions", "meaningful_actions");
  const assertions = readNumber(result, "meaningfulAssertions", "meaningful_assertions");

  if (realExecution !== true) {
    throw new ExecutionProofError("REAL_EXECUTION_REQUIRED", "Result is not marked as real execution.");
  }
  if (simulated !== false) {
    throw new ExecutionProofError("SIMULATED_RESULT_REJECTED", "Simulated execution cannot pass.");
  }
  if (platform === "WINDOWS" || platform === "WINDOWS_DESKTOP" || platform === "LINUX_DESKTOP") {
    if (desktopExecution !== true) {
      throw new ExecutionProofError(
        "DESKTOP_EXECUTION_REQUIRED",
        `${platform} must prove desktop execution.`,
      );
    }
  }
  if (UI_PLATFORMS.has(platform) && sessionCreated !== true) {
    throw new ExecutionProofError(
      "SESSION_PROOF_REQUIRED",
      `${platform} must prove that a real automation session was created.`,
    );
  }
  if (exitCode !== 0) {
    throw new ExecutionProofError(
      "NON_ZERO_EXECUTION_EXIT",
      `Execution exited with code ${String(exitCode)}.`,
      { exitCode },
    );
  }
  if (!Number.isFinite(actions) || actions < 1) {
    throw new ExecutionProofError(
      "MEANINGFUL_ACTION_REQUIRED",
      "At least one passed meaningful action is required.",
    );
  }
  if (!Number.isFinite(assertions) || assertions < 1) {
    throw new ExecutionProofError(
      "MEANINGFUL_ASSERTION_REQUIRED",
      "At least one passed meaningful assertion is required.",
    );
  }

  const artifacts = Array.isArray(result.artifacts) ? result.artifacts : [];
  artifacts.forEach(validateArtifactMetadata);

  const requiredArtifactTypes = new Set(
    (options.requiredArtifactTypes || []).map((value) => String(value).toUpperCase()),
  );
  if (requiredArtifactTypes.size > 0) {
    const present = new Set(artifacts.map((artifact) => String(artifact.type).toUpperCase()));
    const missing = [...requiredArtifactTypes].filter((type) => !present.has(type));
    if (missing.length > 0) {
      throw new ExecutionProofError(
        "REQUIRED_ARTIFACT_MISSING",
        `Required execution artifacts are missing: ${missing.join(", ")}.`,
        { missing },
      );
    }
  }

  return Object.freeze({
    valid: true,
    platform,
    realExecution,
    simulated,
    desktopExecution,
    sessionCreated,
    exitCode,
    meaningfulActions: actions,
    meaningfulAssertions: assertions,
    artifactCount: artifacts.length,
  });
}

module.exports = {
  UI_PLATFORMS,
  ExecutionProofError,
  validateRuntimeProof,
  validateExecutionResult,
  validateArtifactMetadata,
};
