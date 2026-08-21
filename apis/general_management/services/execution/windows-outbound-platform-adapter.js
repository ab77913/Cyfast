"use strict";

const crypto = require("crypto");
const { typedError } = require("./execution-contract");

const TERMINAL_COMMAND_STATES = new Set([
  "COMPLETED", "FAILED", "TIMED_OUT", "CANCELLED", "REJECTED", "EXPIRED", "EVIDENCE_FAILED",
]);
const TERMINAL_JOB_STATES = new Set(["PASSED", "FAILED", "BLOCKED", "CANCELLED"]);

class WindowsOutboundPlatformAdapter {
  constructor(dependencies = {}) {
    this.platform = "WINDOWS";
    this.sessions = dependencies.sessions || require("../windows/windows-session-service");
    this.model = dependencies.model || require("../../database/mysql/factories/windows-w1-factory").model;
    this.publish = dependencies.publish || require("../windows/windows-outbox-publisher").publishPending;
    this.sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = dependencies.now || (() => new Date());
    this.commandTimeoutMs = bounded(dependencies.commandTimeoutMs, 120_000, 5_000, 180_000);
    this.pollIntervalMs = bounded(dependencies.pollIntervalMs, 500, 100, 5_000);
    this.activeJobs = new Map();
  }

  assertTarget(target) {
    const configuration = target?.configuration || {};
    if (String(configuration.transport || "").toUpperCase() !== "OUTBOUND_AGENT") {
      throw typedError("WINDOWS_OUTBOUND_TRANSPORT_REQUIRED", "Windows target transport must be OUTBOUND_AGENT", 422);
    }
    if (!configuration.interactive_session_id) {
      throw typedError(
        "WINDOWS_INTERACTIVE_SESSION_REQUIRED",
        "Windows outbound targets must reference a centrally created interactive_session_id",
        422,
      );
    }
    if (!configuration.application_profile_id) {
      throw typedError(
        "WINDOWS_APPLICATION_PROFILE_REQUIRED",
        "Windows outbound targets must reference an application_profile_id",
        422,
      );
    }
    if (target.endpoint && !["outbound://windows-agent", "outbound://first-party-agent"].includes(String(target.endpoint))) {
      throw typedError("WINDOWS_PUBLIC_ENDPOINT_REJECTED", "Outbound Windows targets must not expose an agent HTTP endpoint", 422);
    }
  }

  async check(target, context = {}) {
    this.assertTarget(target);
    let runtime = await this._command(target, "windows.check_runtime", {
      applicationProfileId: target.configuration.application_profile_id || null,
      executionId: context.execution_id || null,
    }, context);
    if (runtime.ready !== true && target.configuration.auto_recover_runtime !== false) {
      await this._command(target, "windows.recover_runtime", {
        applicationProfileId: target.configuration.application_profile_id || null,
        executionId: context.execution_id || null,
      }, context, 180_000);
      runtime = await this._command(target, "windows.check_runtime", {
        applicationProfileId: target.configuration.application_profile_id || null,
        executionId: context.execution_id || null,
      }, context);
    }
    return { ...runtime, status: runtime.ready === true ? "READY" : "DEGRADED" };
  }

  async execute(target, request) {
    this.assertTarget(target);
    const robotPackage = toRobotPackage(request);
    const context = { correlation_id: request.correlation_id, execution_id: request.execution_id };
    const validation = await this._command(target, "windows.validate_robot_package", robotPackage, context);
    if (validation.valid !== true) {
      throw typedError("PACKAGE_VALIDATION_FAILED", (validation.errors || ["Robot package validation failed"]).join(" | "), 422);
    }
    const started = await this._command(target, "windows.start_robot_job", robotPackage, context);
    const jobId = String(started.jobId || started.job_id || "");
    if (!/^[A-Za-z0-9._:-]{1,256}$/.test(jobId)) {
      throw typedError("ROBOT_JOB_ID_INVALID", "Windows Agent returned an invalid Robot job id", 502);
    }
    this.activeJobs.set(request.execution_id, { target, jobId, context });
    const completion = this._collectJob(target, jobId, context, request.timeout_seconds)
      .finally(() => this.activeJobs.delete(request.execution_id));
    return {
      execution_id: jobId,
      status: "ACCEPTED",
      runtime: request.runtime || {},
      completion,
    };
  }

  async cancel(_target, externalExecutionId, context = {}) {
    const active = [...this.activeJobs.values()].find((entry) => entry.jobId === externalExecutionId);
    if (!active) return { accepted: false, reason: "NO_ACTIVE_AGENT_JOB" };
    await this._command(active.target, "windows.cancel_robot_job", { jobId: active.jobId }, context);
    return { accepted: true, job_id: active.jobId };
  }

  async _collectJob(target, jobId, context, timeoutSeconds) {
    const deadline = this.now().getTime() + bounded(Number(timeoutSeconds) * 1000, 900_000, 30_000, 86_400_000);
    while (this.now().getTime() < deadline) {
      const status = await this._command(target, "windows.get_robot_job_status", { jobId }, context);
      if (TERMINAL_JOB_STATES.has(String(status.status || "").toUpperCase())) {
        const result = await this._command(target, "windows.collect_robot_job_result", { jobId }, context, 180_000);
        return normalizeRobotResult(result);
      }
      await this.sleep(this.pollIntervalMs);
    }
    await this._command(target, "windows.cancel_robot_job", { jobId }, context).catch(() => null);
    throw typedError("ROBOT_TIMEOUT", "Windows Robot job exceeded its bounded execution timeout", 504);
  }

  async _command(target, commandType, payload, context = {}, timeoutMs = this.commandTimeoutMs) {
    const session = await this.sessions.session(
      target.configuration.interactive_session_id,
      target.organization_id,
    );
    if (!session) throw typedError("INTERACTIVE_SESSION_NOT_FOUND", "Configured Windows interactive session was not found", 404);
    if (String(session.application_profile_id) !== String(target.configuration.application_profile_id)) {
      throw typedError("WINDOWS_SESSION_PROFILE_MISMATCH", "Interactive session is not bound to the target application profile", 409);
    }
    const profile = await this.model("WindowsApplicationProfile").findOne({
      where: {
        windows_application_profile_id: target.configuration.application_profile_id,
        organization_id: target.organization_id,
        project_id: target.project_id,
        deleted_date: null,
      },
    });
    if (!profile) {
      throw typedError("WINDOWS_APPLICATION_PROFILE_NOT_FOUND", "Application profile is unavailable in the execution project", 404);
    }
    const command = await this.sessions.issueCommand(
      session,
      commandType,
      payload,
      "execution-lifecycle",
      `${context.execution_id || target.execution_target_id}:${commandType}:${crypto.randomUUID()}`,
      { project_id: target.project_id, execution_id: context.execution_id },
    );
    await this.publish();
    const deadline = this.now().getTime() + timeoutMs;
    while (this.now().getTime() < deadline) {
      const current = await this.model("ExecutionCommand").findByPk(command.execution_command_id);
      if (current && TERMINAL_COMMAND_STATES.has(String(current.status).toUpperCase())) {
        if (current.status !== "COMPLETED") {
          const error = current.result?.Message || current.result?.message || `Windows command ended as ${current.status}`;
          throw typedError(current.result?.ErrorCode || "WINDOWS_COMMAND_FAILED", error, 502);
        }
        const value = current.result?.Payload || current.result?.payload;
        return value && typeof value === "object" ? value : {};
      }
      await this.sleep(this.pollIntervalMs);
    }
    throw typedError("WINDOWS_COMMAND_TIMEOUT", `Windows command timed out: ${commandType}`, 504);
  }
}

function toRobotPackage(request) {
  return {
    executionId: request.execution_id,
    suitePath: request.package.suite_path,
    timeoutSeconds: bounded(request.timeout_seconds, 900, 30, 86_400),
    maxPackageBytes: 225_280,
    allowCoordinateAutomation: request.runtime?.allow_coordinate_automation === true,
    environmentReferences: request.runtime?.environment_references || {},
    files: request.package.files.map((file) => ({
      path: file.path,
      contentBase64: file.content_base64 || file.contentBase64,
      sha256: file.sha256,
    })),
  };
}

function normalizeRobotResult(result) {
  const desktopExecution = result.desktopExecution === true || result.DesktopExecution === true;
  const applicationControlled = result.applicationControlled === true || result.ApplicationControlled === true;
  const meaningfulActions = result.meaningfulActions ?? result.MeaningfulActions ?? 0;
  const meaningfulAssertions = result.meaningfulAssertions ?? result.MeaningfulAssertions ?? 0;
  const artifacts = (result.artifacts || result.Artifacts || []).map((artifact) => ({
    type: mapArtifactType(artifact.type || artifact.Type),
    filename: artifact.fileName || artifact.FileName,
    content_type: artifact.contentType || artifact.ContentType,
    size: artifact.size || artifact.Size,
    sha256: String(artifact.sha256 || artifact.Sha256 || "").toLowerCase(),
    content_base64: artifact.contentBase64 || artifact.ContentBase64,
  }));
  const proof = {
    runtime_os: result.runtimeOs || result.RuntimeOs,
    session_id: result.runtimeProofSessionId || result.RuntimeProofSessionId,
    verified_at: result.runtimeProofVerifiedAt || result.RuntimeProofVerifiedAt,
  };
  const proofBytes = Buffer.from(JSON.stringify(proof), "utf8");
  artifacts.push({
    type: "runtime_proof",
    filename: "runtime-proof.json",
    content_type: "application/json",
    size: proofBytes.length,
    sha256: crypto.createHash("sha256").update(proofBytes).digest("hex"),
    content_base64: proofBytes.toString("base64"),
  });
  return {
    status: result.status || result.Status,
    real_execution: result.realExecution === true || result.RealExecution === true,
    simulated: result.simulated === true || result.Simulated === true,
    desktop_execution: desktopExecution,
    interactive_desktop: result.interactiveDesktop === true || result.InteractiveDesktop === true,
    application_controlled: applicationControlled,
    target_connected: true,
    session_created: result.sessionCreated === true || result.SessionCreated === true,
    exit_code: result.robotExitCode ?? result.RobotExitCode,
    robot_exit_code: result.robotExitCode ?? result.RobotExitCode,
    meaningful_actions_executed:
      result.meaningfulActionsExecuted === true || result.MeaningfulActionsExecuted === true,
    meaningful_actions: meaningfulActions,
    meaningful_assertions_executed:
      result.meaningfulAssertionsExecuted === true || result.MeaningfulAssertionsExecuted === true,
    meaningful_assertions: meaningfulAssertions,
    failure_classification: result.failureClassification || result.FailureClassification,
    failure_message: result.failureMessage || result.FailureMessage,
    stdout: result.stdout || result.Stdout,
    stderr: result.stderr || result.Stderr,
    started_at: result.startedAt || result.StartedAt,
    finished_at: result.finishedAt || result.FinishedAt,
    artifacts,
  };
}

function mapArtifactType(value) {
  return ({
    ROBOT_OUTPUT_XML: "output_xml",
    ROBOT_LOG_HTML: "robot_log_html",
    ROBOT_REPORT_HTML: "robot_report_html",
    STDOUT: "execution_log",
    STDERR: "stderr",
    SCREENSHOT: "screenshot",
  })[String(value || "").toUpperCase()] || String(value || "robot_artifact").toLowerCase();
}

function bounded(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(number), maximum));
}

module.exports = {
  WindowsOutboundPlatformAdapter,
  normalizeRobotResult,
  toRobotPackage,
};
