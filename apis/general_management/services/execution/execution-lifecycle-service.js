"use strict";

const crypto = require("crypto");
const defaultStore = require("./execution-store");
const { createDefaultRegistry } = require("./platform-adapter-registry");
const { hydrateScriptPackage, createSequelizeScriptRepository } = require("./script-package-hydrator");
const defaultArtifacts = require("./execution-artifact-service");
const traceService = require("./execution-trace-service");
const {
  RUN_STATES,
  FAILURE_CLASSES,
  REPAIRABLE_FAILURES,
  validateTarget,
  validateRealPass,
  classifyFailure,
  validateRepair,
  normalizePlatform,
  sha256,
  typedError,
} = require("./execution-contract");

const BLOCKING_FAILURES = new Set([
  FAILURE_CLASSES.ENVIRONMENT_DEFECT,
  FAILURE_CLASSES.TARGET_UNAVAILABLE,
  FAILURE_CLASSES.PERMISSION_FAILURE,
  FAILURE_CLASSES.EVIDENCE_FAILURE,
]);

function createExecutionLifecycle(dependencies = {}) {
  const store = dependencies.store || defaultStore;
  const registry = dependencies.registry || createDefaultRegistry();
  const artifactService = dependencies.artifactService || defaultArtifacts;
  const executionTraceService = dependencies.traceService || traceService;
  const scriptRepository = dependencies.scriptRepository || createSequelizeScriptRepository(store.db);
  const hydrate = dependencies.hydrate || hydrateScriptPackage;
  const now = dependencies.now || (() => new Date());

  async function registerTarget(input, actor) {
    const validation = validateTarget(input);
    if (!validation.valid) throw typedError("INVALID_EXECUTION_TARGET", validation.errors.join(" | "), 422);
    const adapter = registry.get(validation.platform);
    adapter.assertTarget({ ...input, platform: validation.platform });
    return store.createTarget({ ...input, platform: validation.platform }, actor);
  }

  async function checkTarget(targetId, actor) {
    const target = await store.getTarget(targetId, actor);
    if (!target) throw typedError("EXECUTION_TARGET_NOT_FOUND", "Execution target was not found", 404);
    if (target.status === "REVOKED") throw typedError("EXECUTION_TARGET_REVOKED", "Execution target is revoked", 409);
    const adapter = registry.get(target.platform);
    try {
      const health = await adapter.check(target.toJSON ? target.toJSON() : target, { correlation_id: randomId() });
      await store.updateTargetHealth(targetId, actor, health);
      return health;
    } catch (error) {
      await store.updateTargetHealth(targetId, actor, {
        ready: false,
        status: "DEGRADED",
        error_code: error.code || "TARGET_CHECK_FAILED",
        message: error.message,
      });
      throw error;
    }
  }

  async function startRun(input, actor) {
    const target = await store.getTarget(input.execution_target_id, actor);
    if (!target) throw typedError("EXECUTION_TARGET_NOT_FOUND", "Execution target was not found", 404);
    if (target.status === "REVOKED") throw typedError("EXECUTION_TARGET_REVOKED", "Execution target is revoked", 409);
    const targetValue = target.toJSON ? target.toJSON() : target;
    const platform = normalizePlatform(targetValue.platform);
    const idempotencyKey = String(input.idempotency_key || input.idempotencyKey || "").trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw typedError("INVALID_IDEMPOTENCY_KEY", "An 8-128 character idempotency key is required", 400);
    }

    const created = await store.createRun({
      execution_target_id: targetValue.execution_target_id,
      test_script_id: input.test_script_id,
      test_script_version: input.test_script_version,
      parent_execution_run_id: input.parent_execution_run_id,
      root_execution_run_id: input.root_execution_run_id,
      attempt_number: input.attempt_number,
      platform,
      correlation_id: input.correlation_id || randomId(),
      idempotency_key: idempotencyKey,
    }, actor);
    if (!created.created) return created.run;

    let run = created.run;
    try {
      run = await store.transitionRun(run.execution_run_id, actor, RUN_STATES.VALIDATING, {}, {
        event_type: "execution.validation.started.v1",
        actor_type: "SYSTEM",
      });

      const packageValue = await hydrate({
        organizationId: actor.organizationId,
        projectId: actor.projectId,
        testScriptId: input.test_script_id,
        repository: scriptRepository,
      });
      run = await store.patchRun(run.execution_run_id, actor, {
        package_sha256: packageValue.package_sha256,
        package_manifest: packageValue.manifest,
        test_script_version: packageValue.manifest.test_script_version,
      }, "execution.package.hydrated.v1");

      await executionTraceService.appendTraceLinks(run, [
        {
          link_type: "TEST_SCRIPT",
          resource_id: String(input.test_script_id),
          resource_version: String(packageValue.manifest.test_script_version || input.test_script_version || "current"),
          relationship: "USES",
          source_system: "CYFAST",
          metadata: {
            package_sha256: packageValue.package_sha256,
            suite_path: packageValue.suite_path,
          },
        },
        ...(Array.isArray(input.traceability) ? input.traceability : []),
      ], actor);
      await store.appendEvent(run, {
        event_type: "execution.test_script.bound.v1",
        actor_type: "SYSTEM",
        actor_id: "execution-lifecycle",
        payload: { test_script_id: String(input.test_script_id), package_sha256: packageValue.package_sha256 },
      });

      const adapter = registry.get(platform);
      const health = await adapter.check(targetValue, { correlation_id: run.correlation_id });
      await store.updateTargetHealth(targetValue.execution_target_id, actor, health);
      if (health.ready !== true) {
        throw typedError(
          health.error_code || "TARGET_NOT_READY",
          health.message || "Execution target did not report ready",
          409,
        );
      }

      run = await store.transitionRun(run.execution_run_id, actor, RUN_STATES.READY, {
        runtime_snapshot: health,
      }, {
        event_type: "execution.target.ready.v1",
        actor_type: "AGENT",
        actor_id: targetValue.execution_target_id,
        payload: { health },
      });
      run = await store.transitionRun(run.execution_run_id, actor, RUN_STATES.DISPATCHING, {}, {
        event_type: "execution.dispatch.started.v1",
        actor_type: "SYSTEM",
      });

      const dispatch = await adapter.execute(targetValue, {
        execution_id: run.execution_run_id,
        correlation_id: run.correlation_id,
        package: packageValue,
        runtime: input.runtime || {},
        evidence_policy: input.evidence_policy || {},
        timeout_seconds: input.timeout_seconds,
      });
      const externalExecutionId = String(dispatch.execution_id || dispatch.id || dispatch.job_id || "");
      if (!externalExecutionId) throw typedError("TARGET_DISPATCH_INVALID", "Target did not return an external execution id", 502);

      run = await store.transitionRun(run.execution_run_id, actor, RUN_STATES.RUNNING, {
        external_execution_id: externalExecutionId,
        started_at: now(),
        runtime_snapshot: dispatch.runtime || health,
        // Real execution is intentionally not accepted at dispatch time.
        real_execution: false,
        target_connected: false,
        session_created: false,
      }, {
        event_type: "execution.dispatched.v1",
        actor_type: "AGENT",
        actor_id: targetValue.execution_target_id,
        payload: { external_execution_id: externalExecutionId, target_status: dispatch.status || "ACCEPTED" },
      });

      if (dispatch.completion && typeof dispatch.completion.then === "function") {
        dispatch.completion
          .then((result) => finalizeRun(
            run.execution_run_id,
            result,
            internalActor(actor, targetValue.execution_target_id),
          ))
          .catch((error) => failRunFromError(run, actor, error));
      }
      if (dispatch.result) return finalizeRun(run.execution_run_id, dispatch.result, internalActor(actor, targetValue.execution_target_id));
      return run;
    } catch (error) {
      await failRunFromError(run, actor, error);
      throw error;
    }
  }

  async function finalizeRun(runId, result, actor) {
    let run = await store.getRun(runId, actor);
    if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
    if ([RUN_STATES.PASSED, RUN_STATES.FAILED, RUN_STATES.BLOCKED, RUN_STATES.CANCELLED].includes(run.status)) return run;
    if (run.status === RUN_STATES.DISPATCHING) {
      run = await store.transitionRun(runId, actor, RUN_STATES.RUNNING, { started_at: result.started_at || now() }, {
        event_type: "execution.agent.started.v1",
        actor_type: "AGENT",
        actor_id: actor.actorId,
      });
    }
    if (run.status !== RUN_STATES.RUNNING) throw typedError("RUN_NOT_EXECUTING", `Cannot ingest a result while run is ${run.status}`, 409);

    run = await store.transitionRun(runId, actor, RUN_STATES.COLLECTING_EVIDENCE, {}, {
      event_type: "execution.result.received.v1",
      actor_type: "AGENT",
      actor_id: actor.actorId,
      payload: {
        runner_status: result.status,
        exit_code: result.exit_code,
        artifact_count: Array.isArray(result.artifacts) ? result.artifacts.length : 0,
      },
    });

    const evidence = await artifactService.ingestArtifacts(run, result.artifacts || [], actor, {
      requiredEvidence: result.required_evidence,
    });
    if (evidence.failures.length) {
      await store.appendEvent(run, {
        event_type: "execution.artifact.persistence.warning.v1",
        actor_type: "SYSTEM",
        actor_id: "artifact-service",
        payload: { failures: evidence.failures },
      });
    }

    const summary = {
      platform: run.platform,
      status: String(result.status || "FAILED").toUpperCase(),
      real_execution: result.real_execution === true,
      simulated: result.simulated === true,
      target_connected: result.target_connected === true,
      session_created: result.session_created === true,
      exit_code: Number.isFinite(Number(result.exit_code)) ? Number(result.exit_code) : null,
      meaningful_actions: Math.max(Number(result.meaningful_actions || 0), 0),
      meaningful_assertions: Math.max(Number(result.meaningful_assertions || 0), 0),
      evidence: evidence.persisted.map((item) => ({ type: item.artifact_type, sha256: item.content_hash })),
      evidence_complete: evidence.complete,
      evidence_missing: evidence.missing,
      runner_version: result.runner_version || null,
      application_version: result.application_version || null,
      device_version: result.device_version || null,
      started_at: result.started_at || run.started_at,
      finished_at: result.finished_at || now(),
    };

    run = await store.patchRun(runId, actor, {
      result_summary: summary,
      real_execution: summary.real_execution,
      simulated: summary.simulated,
      target_connected: summary.target_connected,
      session_created: summary.session_created,
      exit_code: summary.exit_code,
      meaningful_actions: summary.meaningful_actions,
      meaningful_assertions: summary.meaningful_assertions,
      finished_at: summary.finished_at,
    }, "execution.proof.collected.v1");

    run = await store.transitionRun(runId, actor, RUN_STATES.CLASSIFYING, {}, {
      event_type: "execution.classification.started.v1",
      actor_type: "SYSTEM",
    });

    const proof = validateRealPass(summary, {
      requiredEvidence: result.required_evidence,
    });
    if (proof.pass) {
      return transitionAndSynchronize(runId, actor, RUN_STATES.PASSED, {
        proof_hash: proof.proof_hash,
        failure_classification: null,
        failure_message: null,
        finished_at: summary.finished_at,
      }, {
        event_type: "execution.passed.v1",
        actor_type: "SYSTEM",
        payload: { proof_hash: proof.proof_hash },
      });
    }

    const classification = classifyFailure({
      ...result,
      execution_succeeded: summary.exit_code === 0 && summary.status === "PASSED",
      evidence_complete: evidence.complete,
      failure_message: result.failure_message || proof.errors.join(" | "),
    });
    const message = String(result.failure_message || result.message || proof.errors.join(" | ") || "Execution failed").slice(0, 16_384);
    const terminalPatch = {
      proof_hash: proof.proof_hash,
      failure_classification: classification,
      failure_message: message,
      finished_at: summary.finished_at,
    };

    const defect = await createFailureDefect(run, result, classification, message, actor);
    await store.appendEvent(run, {
      event_type: "execution.defect.created.v1",
      actor_type: "SYSTEM",
      actor_id: "failure-classifier",
      payload: { execution_defect_id: defect.execution_defect_id, classification },
    });

    if (REPAIRABLE_FAILURES.has(classification) && Number(run.attempt_number || 1) < 3) {
      return store.transitionRun(runId, actor, RUN_STATES.REPAIR_PENDING, terminalPatch, {
        event_type: "execution.repair.eligible.v1",
        actor_type: "SYSTEM",
        payload: { classification, maximum_attempts: 3 },
      });
    }
    if (BLOCKING_FAILURES.has(classification)) {
      return transitionAndSynchronize(runId, actor, RUN_STATES.BLOCKED, terminalPatch, {
        event_type: "execution.blocked.v1",
        actor_type: "SYSTEM",
        payload: { classification },
      });
    }
    return transitionAndSynchronize(runId, actor, RUN_STATES.FAILED, terminalPatch, {
      event_type: "execution.failed.v1",
      actor_type: "SYSTEM",
      payload: { classification },
    });
  }

  async function cancelRun(runId, actor) {
    const run = await store.getRun(runId, actor);
    if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
    if ([RUN_STATES.PASSED, RUN_STATES.FAILED, RUN_STATES.BLOCKED, RUN_STATES.CANCELLED].includes(run.status)) return run;

    const target = await store.getTarget(run.execution_target_id, actor);
    if (target && run.external_execution_id) {
      try {
        await registry.get(run.platform).cancel(target.toJSON ? target.toJSON() : target, run.external_execution_id, {
          correlation_id: run.correlation_id,
        });
      } catch (error) {
        await store.appendEvent(run, {
          event_type: "execution.cancel.propagation.warning.v1",
          actor_type: "SYSTEM",
          payload: { code: error.code, message: error.message },
        });
      }
    }
    return transitionAndSynchronize(runId, actor, RUN_STATES.CANCELLED, {
      cancelled_at: now(),
      finished_at: now(),
      failure_classification: FAILURE_CLASSES.EXECUTION_CANCELLED,
      failure_message: "Execution cancelled by user",
    }, {
      event_type: "execution.cancelled.v1",
      actor_type: "USER",
      actor_id: actor.userId,
    });
  }

  async function proposeRepair(runId, input, actor) {
    const run = await store.getRun(runId, actor);
    if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
    if (run.status !== RUN_STATES.REPAIR_PENDING) throw typedError("REPAIR_NOT_PENDING", `Run is not awaiting repair: ${run.status}`, 409);
    const attempts = await store.listRepairAttempts(runId, actor, { page: 1, page_size: 100 });
    const attemptNumber = attempts.pagination.total + 1;
    const validation = validateRepair({
      failure_classification: run.failure_classification,
      attempt_number: attemptNumber,
      before_script: input.before_script,
      after_script: input.after_script,
      diff_summary: input.diff_summary || input.proposed_patch,
    });
    if (!validation.valid) throw typedError("REPAIR_POLICY_REJECTED", validation.errors.join(" | "), 422);

    const repair = await store.createRepairAttempt(run, {
      attempt_number: attemptNumber,
      failure_classification: run.failure_classification,
      base_script_version: run.test_script_version,
      proposed_script_hash: sha256(String(input.after_script)),
      proposed_patch: String(input.proposed_patch || input.after_script),
      rationale: input.rationale,
      validation_result: validation,
      approval_status: input.auto_approve === true ? "APPROVED" : "PENDING",
    }, actor);
    await store.appendEvent(run, {
      event_type: "execution.repair.proposed.v1",
      actor_type: "AI",
      actor_id: input.model_id || "cyfast-repair-agent",
      payload: {
        execution_repair_attempt_id: repair.execution_repair_attempt_id,
        attempt_number: attemptNumber,
        proposed_script_hash: repair.proposed_script_hash,
        approval_status: repair.approval_status,
      },
    });
    return repair;
  }

  async function approveRepairAndRerun(runId, repairId, input, actor) {
    const run = await store.getRun(runId, actor);
    if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
    const repair = await store.getRepairAttempt(repairId, actor);
    if (!repair || repair.execution_run_id !== run.execution_run_id) throw typedError("REPAIR_ATTEMPT_NOT_FOUND", "Repair attempt was not found", 404);
    if (!input.approved_test_script_id) {
      throw typedError(
        "APPROVED_SCRIPT_VERSION_REQUIRED",
        "The repaired script must be saved and approved through the normal Test Script versioning flow before rerun",
        422,
      );
    }

    const rerun = await startRun({
      execution_target_id: run.execution_target_id,
      test_script_id: input.approved_test_script_id,
      test_script_version: input.approved_test_script_version,
      parent_execution_run_id: run.execution_run_id,
      root_execution_run_id: run.root_execution_run_id || run.execution_run_id,
      attempt_number: Number(run.attempt_number || 1) + 1,
      idempotency_key: input.idempotency_key,
      correlation_id: run.correlation_id,
      timeout_seconds: input.timeout_seconds,
      runtime: input.runtime,
      evidence_policy: input.evidence_policy,
    }, actor);
    await store.approveRepairAttempt(repairId, actor, rerun.execution_run_id);
    await store.appendEvent(run, {
      event_type: "execution.repair.approved.v1",
      actor_type: "USER",
      actor_id: actor.userId,
      payload: {
        execution_repair_attempt_id: repairId,
        rerun_execution_run_id: rerun.execution_run_id,
        approved_test_script_id: String(input.approved_test_script_id),
      },
    });
    await store.transitionRun(run.execution_run_id, actor, RUN_STATES.FAILED, {
      result_summary: {
        ...(run.result_summary || {}),
        superseded_by_execution_run_id: rerun.execution_run_id,
        repair_attempt_id: repairId,
      },
    }, {
      event_type: "execution.repair.superseded.v1",
      actor_type: "USER",
      actor_id: actor.userId,
      payload: { rerun_execution_run_id: rerun.execution_run_id, execution_repair_attempt_id: repairId },
    });
    return rerun;
  }

  async function failRunFromError(run, actor, error) {
    if (!run?.execution_run_id) return null;
    const current = await store.getRun(run.execution_run_id, actor);
    if (!current || [RUN_STATES.PASSED, RUN_STATES.FAILED, RUN_STATES.BLOCKED, RUN_STATES.CANCELLED].includes(current.status)) return current;
    const classification = classifyFailure({ code: error.code, message: error.message, agent_online: error.code === "TARGET_CREDENTIAL_UNAVAILABLE" ? false : undefined });
    const state = BLOCKING_FAILURES.has(classification) ? RUN_STATES.BLOCKED : RUN_STATES.FAILED;
    return store.transitionRun(current.execution_run_id, actor, state, {
      failure_classification: classification,
      failure_message: String(error.message || error).slice(0, 16_384),
      finished_at: now(),
    }, {
      event_type: state === RUN_STATES.BLOCKED ? "execution.blocked.v1" : "execution.failed.v1",
      actor_type: "SYSTEM",
      payload: { code: error.code || "EXECUTION_ERROR", classification },
    });
  }

  async function createFailureDefect(run, result, classification, message, actor) {
    return store.createDefect(run, {
      requirement_id: result.requirement_id,
      test_scenario_id: result.test_scenario_id,
      test_case_id: result.test_case_id,
      test_script_id: run.test_script_id,
      classification,
      severity: result.severity || severityFor(classification),
      title: `${classification}: ${String(result.test_name || result.suite_name || "Execution failure").slice(0, 400)}`,
      description: message,
      expected_result: result.expected_result,
      actual_result: result.actual_result || message,
    }, actor);
  }

  async function transitionAndSynchronize(...arguments_) {
    const terminal = await store.transitionRun(...arguments_);
    if (!terminal) return terminal;
    const actor = arguments_[1];
    try {
      const qualityExecution = require("../quality-lifecycle-execution-service");
      await qualityExecution.synchronizeRun(terminal, actor);
      try {
        const productFix = require("./execution-product-fix-service");
        await productFix.synchronizeVerification(terminal, actor);
      } catch (productFixError) {
        await store.appendEvent(terminal, {
          event_type: "execution.product_fix_sync.warning.v1",
          actor_type: "SYSTEM",
          actor_id: "product-fix-sync",
          payload: { code: productFixError.code || "PRODUCT_FIX_SYNC_FAILED", message: productFixError.message },
        });
      }

    } catch (error) {
      await store.appendEvent(terminal, {
        event_type: "execution.quality_lifecycle_sync.warning.v1",
        actor_type: "SYSTEM",
        actor_id: "quality-lifecycle-sync",
        payload: { code: error.code || "QUALITY_LIFECYCLE_SYNC_FAILED", message: error.message },
      });
    }
    return terminal;
  }

  return {
    registerTarget,
    checkTarget,
    startRun,
    finalizeRun,
    cancelRun,
    proposeRepair,
    approveRepairAndRerun,
  };
}

function severityFor(classification) {
  if ([FAILURE_CLASSES.PRODUCT_DEFECT, FAILURE_CLASSES.ASSERTION_FAILURE].includes(classification)) return "HIGH";
  if ([FAILURE_CLASSES.ENVIRONMENT_DEFECT, FAILURE_CLASSES.TARGET_UNAVAILABLE].includes(classification)) return "MEDIUM";
  return "LOW";
}

function randomId() {
  return crypto.randomUUID().replace(/-/g, "");
}

function internalActor(actor, targetId) {
  return {
    organizationId: actor.organizationId,
    projectId: actor.projectId,
    actorType: "AGENT",
    actorId: targetId,
  };
}

const lifecycle = createExecutionLifecycle();

module.exports = {
  BLOCKING_FAILURES,
  createExecutionLifecycle,
  ...lifecycle,
};
