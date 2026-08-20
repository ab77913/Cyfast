"use strict";

const crypto = require("crypto");
const {
  EXECUTION_STATUS,
  assertTransition,
  isTerminal,
} = require("./execution-state-machine");
const {
  classifyFailure,
  isBlockingEnvironmentFailure,
  requiresProductDefect,
} = require("./failure-classifier");
const {
  ExecutionProofError,
  validateRuntimeProof,
  validateExecutionResult,
} = require("./execution-proof-validator");
const {
  evaluateRepairEligibility,
  assertSafeRepairProposal,
} = require("./repair-policy");

const RECOVERABLE_STATUSES = Object.freeze([
  EXECUTION_STATUS.QUEUED,
  EXECUTION_STATUS.VALIDATING_PACKAGE,
  EXECUTION_STATUS.CHECKING_RUNTIME,
  EXECUTION_STATUS.RECOVERING_RUNTIME,
  EXECUTION_STATUS.READY,
  EXECUTION_STATUS.RUNNING,
  EXECUTION_STATUS.COLLECTING_ARTIFACTS,
  EXECUTION_STATUS.CLASSIFYING_FAILURE,
  EXECUTION_STATUS.REPAIR_PENDING,
  EXECUTION_STATUS.REPAIRING,
  EXECUTION_STATUS.RERUN_QUEUED,
  EXECUTION_STATUS.CANCEL_REQUESTED,
]);

class ExecutionLifecycleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ExecutionLifecycleError";
    this.code = code;
    this.details = details;
  }
}

function requireFunction(target, name, owner) {
  if (!target || typeof target[name] !== "function") {
    throw new TypeError(`${owner}.${name} must be a function.`);
  }
}

function normalizePlatform(value) {
  const platform = String(value || "").trim().toUpperCase();
  if (!platform) {
    throw new ExecutionLifecycleError("PLATFORM_REQUIRED", "Execution platform is required.");
  }
  return platform;
}

function boundedString(value, maximum = 4096) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length <= maximum ? text : text.slice(0, maximum);
}

function safeJsonValue(value, depth = 0) {
  if (depth > 8) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return /(password|secret|token|api[_-]?key|authorization)/i.test(value)
      ? "[REDACTED]"
      : boundedString(value, 16_384);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 256).map((item) => safeJsonValue(item, depth + 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value).slice(0, 256)) {
      output[key] = /(password|secret|token|api[_-]?key|authorization|contentBase64)/i.test(key)
        ? "[REDACTED]"
        : safeJsonValue(child, depth + 1);
    }
    return output;
  }
  return boundedString(value, 1024);
}

function nowIso(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("clock must return a valid date.");
  return date.toISOString();
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

class ExecutionLifecycleOrchestrator {
  constructor(options = {}) {
    this.repository = options.repository;
    this.adapterRegistry = options.adapterRegistry;
    this.artifactStore = options.artifactStore;
    this.defectService = options.defectService || null;
    this.repairEngine = options.repairEngine || null;
    this.eventPublisher = options.eventPublisher || null;
    this.clock = options.clock || (() => new Date());
    this.idGenerator = options.idGenerator || (() => crypto.randomUUID());
    this.maxRepairAttempts = Number.isSafeInteger(Number(options.maxRepairAttempts))
      ? Math.max(0, Math.min(Number(options.maxRepairAttempts), 10))
      : 3;
    this.runtimeProofMaximumAgeMs = Number.isFinite(Number(options.runtimeProofMaximumAgeMs))
      ? Math.max(10_000, Number(options.runtimeProofMaximumAgeMs))
      : 5 * 60 * 1000;
    this.requiredArtifactTypes = options.requiredArtifactTypes || {};
    this._active = new Map();

    requireFunction(this.repository, "createExecution", "repository");
    requireFunction(this.repository, "getExecution", "repository");
    requireFunction(this.repository, "updateExecution", "repository");
    requireFunction(this.repository, "appendEvent", "repository");
    requireFunction(this.adapterRegistry, "resolve", "adapterRegistry");
    requireFunction(this.artifactStore, "persist", "artifactStore");
  }

  async createExecution(command = {}, principal = {}) {
    const platform = normalizePlatform(command.platform);
    const organizationId = String(command.organizationId || principal.organizationId || "").trim();
    const projectId = String(command.projectId || principal.projectId || "").trim();
    const idempotencyKey = String(command.idempotencyKey || "").trim();
    if (!organizationId) {
      throw new ExecutionLifecycleError("ORGANIZATION_REQUIRED", "organizationId is required.");
    }
    if (!projectId) {
      throw new ExecutionLifecycleError("PROJECT_REQUIRED", "projectId is required.");
    }
    if (!idempotencyKey || idempotencyKey.length > 256) {
      throw new ExecutionLifecycleError(
        "IDEMPOTENCY_KEY_REQUIRED",
        "A bounded idempotencyKey is required.",
      );
    }
    if (!command.package || typeof command.package !== "object") {
      throw new ExecutionLifecycleError("PACKAGE_REQUIRED", "An executable test package is required.");
    }
    if (!command.target || typeof command.target !== "object") {
      throw new ExecutionLifecycleError("TARGET_REQUIRED", "A real execution target is required.");
    }

    if (typeof this.repository.findByIdempotencyKey === "function") {
      const existing = await this.repository.findByIdempotencyKey({
        organizationId,
        projectId,
        idempotencyKey,
      });
      if (existing) return existing;
    }

    const executionId = this.idGenerator();
    const createdAt = nowIso(this.clock);
    const packageSnapshot = structuredClone(command.package);
    const targetSnapshot = structuredClone(command.target);
    const execution = {
      id: executionId,
      organizationId,
      projectId,
      platform,
      status: EXECUTION_STATUS.CREATED,
      statusVersion: 1,
      idempotencyKey,
      correlationId: String(command.correlationId || executionId),
      requirementId: command.requirementId || null,
      scenarioId: command.scenarioId || null,
      testCaseId: command.testCaseId || null,
      testScriptId: command.testScriptId || null,
      packageSnapshot,
      packageSha256: sha256Text(JSON.stringify(packageSnapshot)),
      targetSnapshot,
      targetId: command.target.id || command.target.targetId || null,
      requestedBy: principal.userId || principal.id || command.requestedBy || null,
      repairAttempts: 0,
      attemptNumber: 0,
      cancelRequested: false,
      createdAt,
      updatedAt: createdAt,
      startedAt: null,
      finishedAt: null,
      failureClassification: null,
      failureCode: null,
      failureMessage: null,
      defectId: null,
    };

    const stored = await this.repository.createExecution(execution);
    await this._appendEvent(stored, "EXECUTION_CREATED", {
      platform,
      targetId: execution.targetId,
      packageSha256: execution.packageSha256,
      requestedBy: execution.requestedBy,
    });
    return this._transition(stored, EXECUTION_STATUS.QUEUED, {
      eventType: "EXECUTION_QUEUED",
    });
  }

  async start(command, principal = {}) {
    const execution = await this.createExecution(command, principal);
    this.run(execution.id).catch(() => {
      // The persisted terminal state and events are authoritative; callers may poll or stream them.
    });
    return execution;
  }

  async run(executionId) {
    if (this._active.has(executionId)) return this._active.get(executionId);
    const promise = this._runInternal(executionId).finally(() => this._active.delete(executionId));
    this._active.set(executionId, promise);
    return promise;
  }

  async requestCancellation(executionId, principal = {}) {
    let execution = await this._getExecution(executionId);
    if (isTerminal(execution.status)) return execution;
    if (execution.status !== EXECUTION_STATUS.CANCEL_REQUESTED) {
      execution = await this._transition(execution, EXECUTION_STATUS.CANCEL_REQUESTED, {
        eventType: "EXECUTION_CANCELLATION_REQUESTED",
        patch: {
          cancelRequested: true,
          cancelRequestedBy: principal.userId || principal.id || null,
          cancelRequestedAt: nowIso(this.clock),
        },
      });
    }

    try {
      const adapter = await this.adapterRegistry.resolve({
        platform: execution.platform,
        target: execution.targetSnapshot,
        execution,
      });
      if (adapter && typeof adapter.cancel === "function") {
        await adapter.cancel({ executionId, execution });
      }
    } catch (error) {
      await this._appendEvent(execution, "EXECUTION_CANCELLATION_FORWARD_FAILED", {
        code: error.code || "CANCELLATION_FORWARD_FAILED",
        message: boundedString(error.message),
      });
    }
    return execution;
  }

  async recoverInterruptedExecutions() {
    if (typeof this.repository.listExecutionsByStatus !== "function") return [];
    const executions = await this.repository.listExecutionsByStatus(RECOVERABLE_STATUSES);
    const results = [];
    for (const execution of executions || []) {
      if (execution.status === EXECUTION_STATUS.CANCEL_REQUESTED) {
        results.push(await this._cancelTerminal(execution));
        continue;
      }
      await this._appendEvent(execution, "EXECUTION_RECOVERY_SCHEDULED", {
        previousStatus: execution.status,
      });
      results.push(await this.run(execution.id));
    }
    return results;
  }

  async _runInternal(executionId) {
    let execution = await this._getExecution(executionId);
    if (isTerminal(execution.status)) return execution;
    if (execution.status === EXECUTION_STATUS.CANCEL_REQUESTED || execution.cancelRequested) {
      return this._cancelTerminal(execution);
    }

    let adapter;
    try {
      adapter = await this.adapterRegistry.resolve({
        platform: execution.platform,
        target: execution.targetSnapshot,
        execution,
      });
      if (!adapter) {
        throw new ExecutionLifecycleError(
          "PLATFORM_ADAPTER_NOT_FOUND",
          `No platform adapter is registered for ${execution.platform}.`,
        );
      }
      requireFunction(adapter, "validatePackage", "platformAdapter");
      requireFunction(adapter, "checkRuntime", "platformAdapter");
      requireFunction(adapter, "execute", "platformAdapter");
    } catch (error) {
      return this._block(execution, error, "PLATFORM_ADAPTER_RESOLUTION_FAILED");
    }

    while (!isTerminal(execution.status)) {
      execution = await this._refresh(execution.id);
      if (execution.status === EXECUTION_STATUS.CANCEL_REQUESTED || execution.cancelRequested) {
        return this._cancelTerminal(execution);
      }

      const attemptNumber = Number(execution.attemptNumber || 0) + 1;
      execution = await this._ensureStatus(execution, EXECUTION_STATUS.VALIDATING_PACKAGE, {
        eventType: "PACKAGE_VALIDATION_STARTED",
        patch: {
          attemptNumber,
          startedAt: execution.startedAt || nowIso(this.clock),
        },
        details: { attemptNumber },
      });

      let validation;
      try {
        validation = await adapter.validatePackage({
          execution,
          package: execution.packageSnapshot,
          attemptNumber,
        });
      } catch (error) {
        return this._fail(execution, error, "PACKAGE_VALIDATION_FAILED");
      }
      if (!validation || validation.valid !== true) {
        return this._fail(
          execution,
          new ExecutionLifecycleError(
            "PACKAGE_VALIDATION_FAILED",
            validation?.errors?.join(" | ") || "Test package validation failed.",
            { validation: safeJsonValue(validation) },
          ),
          "PACKAGE_VALIDATION_FAILED",
        );
      }
      await this._appendEvent(execution, "PACKAGE_VALIDATED", {
        attemptNumber,
        packageBytes: validation.packageBytes,
        meaningfulActions: validation.meaningfulActions,
        meaningfulAssertions: validation.meaningfulAssertions,
        warnings: validation.warnings,
      });

      execution = await this._transition(execution, EXECUTION_STATUS.CHECKING_RUNTIME, {
        eventType: "RUNTIME_CHECK_STARTED",
        details: { attemptNumber },
      });

      let runtimeProof;
      try {
        runtimeProof = await adapter.checkRuntime({ execution, attemptNumber });
        if (!runtimeProof?.ready && typeof adapter.recoverRuntime === "function") {
          execution = await this._transition(execution, EXECUTION_STATUS.RECOVERING_RUNTIME, {
            eventType: "RUNTIME_RECOVERY_STARTED",
            details: { attemptNumber, errors: runtimeProof?.errors },
          });
          runtimeProof = await adapter.recoverRuntime({ execution, attemptNumber, runtimeProof });
          execution = await this._transition(execution, EXECUTION_STATUS.CHECKING_RUNTIME, {
            eventType: "RUNTIME_RECHECK_STARTED",
            details: { attemptNumber },
          });
        }
        const runtimeValidation = validateRuntimeProof(runtimeProof, {
          now: this.clock(),
          maximumAgeMs: this.runtimeProofMaximumAgeMs,
        });
        await this._appendEvent(execution, "RUNTIME_PROOF_VERIFIED", {
          attemptNumber,
          verifiedAt: runtimeValidation.verifiedAt,
          ageMs: runtimeValidation.ageMs,
          runtimeOs: runtimeProof.runtimeOs,
          sessionId: runtimeProof.driverSession?.sessionId || null,
        });
      } catch (error) {
        return this._block(execution, error, error.code || "RUNTIME_NOT_READY");
      }

      execution = await this._transition(execution, EXECUTION_STATUS.READY, {
        eventType: "EXECUTION_TARGET_READY",
        patch: {
          runtimeProof: safeJsonValue(runtimeProof),
          runtimeProofVerifiedAt:
            runtimeProof.driverSession?.lastVerifiedAt || runtimeProof.checkedAt || nowIso(this.clock),
        },
        details: { attemptNumber },
      });
      execution = await this._transition(execution, EXECUTION_STATUS.RUNNING, {
        eventType: "REAL_EXECUTION_STARTED",
        details: { attemptNumber, platform: execution.platform },
      });

      let result;
      try {
        result = await adapter.execute({
          execution,
          package: execution.packageSnapshot,
          runtimeProof,
          attemptNumber,
          onEvent: async (eventType, details) => {
            const current = await this._refresh(execution.id);
            await this._appendEvent(current, eventType || "TARGET_EXECUTION_EVENT", {
              attemptNumber,
              ...safeJsonValue(details),
            });
          },
        });
      } catch (error) {
        result = {
          realExecution: true,
          simulated: false,
          desktopExecution: Boolean(runtimeProof.desktopExecution),
          sessionCreated: Boolean(runtimeProof.driverSession?.sessionCreated),
          exitCode: Number.isFinite(Number(error.exitCode)) ? Number(error.exitCode) : 1,
          meaningfulActions: Number(error.meaningfulActions || 0),
          meaningfulAssertions: Number(error.meaningfulAssertions || 0),
          failureClassification: error.failureClassification,
          errorCode: error.code || "TARGET_EXECUTION_FAILED",
          failureMessage: error.message,
          stdout: error.stdout,
          stderr: error.stderr,
          artifacts: error.artifacts || [],
        };
      }

      execution = await this._transition(execution, EXECUTION_STATUS.COLLECTING_ARTIFACTS, {
        eventType: "ARTIFACT_COLLECTION_STARTED",
        details: { attemptNumber },
      });

      const persistedArtifacts = [];
      try {
        for (const artifact of Array.isArray(result?.artifacts) ? result.artifacts : []) {
          const persisted = await this.artifactStore.persist({
            organizationId: execution.organizationId,
            projectId: execution.projectId,
            executionId: execution.id,
            attemptNumber,
            artifact,
          });
          persistedArtifacts.push(persisted);
          await this._appendEvent(execution, "EXECUTION_ARTIFACT_PERSISTED", {
            attemptNumber,
            artifactId: persisted.id || persisted.artifactId,
            type: artifact.type,
            fileName: artifact.fileName,
            sha256: artifact.sha256,
            size: artifact.size,
          });
        }
      } catch (error) {
        return this._block(execution, error, "ARTIFACT_UPLOAD_FAILED");
      }

      const resultForProof = {
        ...result,
        artifacts: Array.isArray(result?.artifacts) ? result.artifacts : [],
      };
      try {
        const proof = validateExecutionResult(resultForProof, {
          platform: execution.platform,
          requiredArtifactTypes: this.requiredArtifactTypes[execution.platform] || [],
        });
        execution = await this._transition(execution, EXECUTION_STATUS.PASSED, {
          eventType: "EXECUTION_PASSED",
          patch: {
            finishedAt: nowIso(this.clock),
            finalAttemptNumber: attemptNumber,
            resultProof: proof,
            artifactCount: persistedArtifacts.length,
            failureClassification: null,
            failureCode: null,
            failureMessage: null,
          },
          details: {
            attemptNumber,
            proof,
            artifactCount: persistedArtifacts.length,
          },
        });
        return execution;
      } catch (error) {
        const proofError = error instanceof ExecutionProofError
          ? error
          : new ExecutionProofError("EXECUTION_PROOF_INVALID", error.message);
        execution = await this._transition(execution, EXECUTION_STATUS.CLASSIFYING_FAILURE, {
          eventType: "EXECUTION_PROOF_REJECTED",
          patch: {
            lastResult: safeJsonValue(result),
            artifactCount: persistedArtifacts.length,
          },
          details: {
            attemptNumber,
            code: proofError.code,
            message: proofError.message,
          },
        });

        const classification = classifyFailure({
          ...result,
          errorCode: result?.errorCode || proofError.code,
          failureMessage: result?.failureMessage || proofError.message,
        });
        execution = await this.repository.updateExecution(execution.id, {
          failureClassification: classification,
          failureCode: result?.errorCode || proofError.code,
          failureMessage: boundedString(result?.failureMessage || proofError.message),
          updatedAt: nowIso(this.clock),
        }, execution.statusVersion);
        await this._appendEvent(execution, "EXECUTION_FAILURE_CLASSIFIED", {
          attemptNumber,
          classification,
          code: execution.failureCode,
          message: execution.failureMessage,
        });

        if (isBlockingEnvironmentFailure(classification)) {
          return this._transition(execution, EXECUTION_STATUS.BLOCKED, {
            eventType: "EXECUTION_BLOCKED",
            patch: { finishedAt: nowIso(this.clock) },
            details: { attemptNumber, classification },
          });
        }

        if (requiresProductDefect(classification)) {
          if (this.defectService && typeof this.defectService.create === "function") {
            const defect = await this.defectService.create({
              organizationId: execution.organizationId,
              projectId: execution.projectId,
              executionId: execution.id,
              attemptNumber,
              requirementId: execution.requirementId,
              scenarioId: execution.scenarioId,
              testCaseId: execution.testCaseId,
              testScriptId: execution.testScriptId,
              platform: execution.platform,
              targetId: execution.targetId,
              classification,
              expectedResult: execution.packageSnapshot.expectedResult || null,
              actualResult: result?.failureMessage || proofError.message,
              artifacts: persistedArtifacts,
            });
            execution = await this.repository.updateExecution(execution.id, {
              defectId: defect.id || defect.defectId,
              updatedAt: nowIso(this.clock),
            }, execution.statusVersion);
            await this._appendEvent(execution, "PRODUCT_DEFECT_CREATED", {
              attemptNumber,
              defectId: execution.defectId,
              classification,
            });
          }
          return this._transition(execution, EXECUTION_STATUS.FAILED, {
            eventType: "EXECUTION_FAILED",
            patch: { finishedAt: nowIso(this.clock) },
            details: { attemptNumber, classification, defectId: execution.defectId },
          });
        }

        const eligibility = evaluateRepairEligibility({
          classification,
          repairAttempts: execution.repairAttempts,
          approvalRequired: execution.packageSnapshot.repairApprovalRequired === true,
          approved: execution.packageSnapshot.repairApproved === true,
        }, { maxAttempts: this.maxRepairAttempts });

        if (!eligibility.eligible || !this.repairEngine) {
          await this._appendEvent(execution, "AUTOMATION_REPAIR_NOT_APPLIED", {
            attemptNumber,
            classification,
            reason: eligibility.reason || "REPAIR_ENGINE_UNAVAILABLE",
          });
          return this._transition(execution, EXECUTION_STATUS.FAILED, {
            eventType: "EXECUTION_FAILED",
            patch: { finishedAt: nowIso(this.clock) },
            details: { attemptNumber, classification },
          });
        }

        execution = await this._transition(execution, EXECUTION_STATUS.REPAIR_PENDING, {
          eventType: "AUTOMATION_REPAIR_PENDING",
          details: {
            attemptNumber,
            classification,
            nextRepairAttempt: eligibility.nextAttempt,
          },
        });

        let proposal;
        try {
          proposal = await this.repairEngine.propose({
            execution,
            attemptNumber,
            classification,
            result,
            artifacts: persistedArtifacts,
            package: structuredClone(execution.packageSnapshot),
          });
          assertSafeRepairProposal(proposal);
        } catch (error) {
          return this._fail(execution, error, error.code || "AUTOMATION_REPAIR_REJECTED");
        }

        execution = await this._transition(execution, EXECUTION_STATUS.REPAIRING, {
          eventType: "AUTOMATION_REPAIR_STARTED",
          details: {
            attemptNumber,
            repairAttempt: eligibility.nextAttempt,
            summary: proposal.summary,
          },
        });

        let updatedPackage;
        try {
          updatedPackage = typeof this.repairEngine.apply === "function"
            ? await this.repairEngine.apply({ execution, proposal })
            : proposal.updatedPackage;
          if (!updatedPackage || typeof updatedPackage !== "object") {
            throw new ExecutionLifecycleError(
              "AUTOMATION_REPAIR_EMPTY",
              "Repair engine did not return a complete updated package.",
            );
          }
        } catch (error) {
          return this._fail(execution, error, error.code || "AUTOMATION_REPAIR_FAILED");
        }

        const previousPackageSha256 = execution.packageSha256;
        const packageSnapshot = structuredClone(updatedPackage);
        const packageSha256 = sha256Text(JSON.stringify(packageSnapshot));
        execution = await this.repository.updateExecution(execution.id, {
          packageSnapshot,
          packageSha256,
          repairAttempts: eligibility.nextAttempt,
          updatedAt: nowIso(this.clock),
        }, execution.statusVersion);
        await this._appendEvent(execution, "AUTOMATION_REPAIR_APPLIED", {
          attemptNumber,
          repairAttempt: eligibility.nextAttempt,
          summary: proposal.summary,
          previousPackageSha256,
          packageSha256,
        });
        execution = await this._transition(execution, EXECUTION_STATUS.RERUN_QUEUED, {
          eventType: "EXECUTION_RERUN_QUEUED",
          details: {
            previousAttemptNumber: attemptNumber,
            nextAttemptNumber: attemptNumber + 1,
          },
        });
      }
    }
    return execution;
  }

  async _getExecution(executionId) {
    if (!executionId) {
      throw new ExecutionLifecycleError("EXECUTION_ID_REQUIRED", "executionId is required.");
    }
    const execution = await this.repository.getExecution(executionId);
    if (!execution) {
      throw new ExecutionLifecycleError("EXECUTION_NOT_FOUND", "Execution was not found.");
    }
    return execution;
  }

  async _refresh(executionId) {
    return this._getExecution(executionId);
  }

  async _ensureStatus(execution, targetStatus, options = {}) {
    if (execution.status === targetStatus) return execution;
    if (targetStatus === EXECUTION_STATUS.VALIDATING_PACKAGE &&
        ![EXECUTION_STATUS.QUEUED, EXECUTION_STATUS.RERUN_QUEUED].includes(execution.status)) {
      execution = await this.repository.updateExecution(execution.id, {
        status: EXECUTION_STATUS.RERUN_QUEUED,
        statusVersion: Number(execution.statusVersion || 0) + 1,
        updatedAt: nowIso(this.clock),
      }, execution.statusVersion);
    }
    return this._transition(execution, targetStatus, options);
  }

  async _transition(execution, nextStatus, options = {}) {
    assertTransition(execution.status, nextStatus);
    if (execution.status === nextStatus) return execution;
    const timestamp = nowIso(this.clock);
    const patch = {
      ...(options.patch || {}),
      status: nextStatus,
      statusVersion: Number(execution.statusVersion || 0) + 1,
      updatedAt: timestamp,
    };
    const updated = await this.repository.updateExecution(
      execution.id,
      patch,
      execution.statusVersion,
    );
    await this._appendEvent(updated, options.eventType || "EXECUTION_STATUS_CHANGED", {
      from: execution.status,
      to: nextStatus,
      ...(options.details || {}),
    });
    return updated;
  }

  async _appendEvent(execution, type, details = {}) {
    const event = {
      id: this.idGenerator(),
      executionId: execution.id,
      organizationId: execution.organizationId,
      projectId: execution.projectId,
      sequence: typeof this.repository.nextEventSequence === "function"
        ? await this.repository.nextEventSequence(execution.id)
        : undefined,
      type: String(type || "EXECUTION_EVENT"),
      status: execution.status,
      details: safeJsonValue(details),
      createdAt: nowIso(this.clock),
    };
    const stored = await this.repository.appendEvent(event);
    if (this.eventPublisher && typeof this.eventPublisher.publish === "function") {
      await this.eventPublisher.publish(stored || event);
    }
    return stored || event;
  }

  async _cancelTerminal(execution) {
    if (execution.status !== EXECUTION_STATUS.CANCEL_REQUESTED) {
      execution = await this._transition(execution, EXECUTION_STATUS.CANCEL_REQUESTED, {
        eventType: "EXECUTION_CANCELLATION_REQUESTED",
        patch: { cancelRequested: true },
      });
    }
    return this._transition(execution, EXECUTION_STATUS.CANCELLED, {
      eventType: "EXECUTION_CANCELLED",
      patch: { finishedAt: nowIso(this.clock), cancelRequested: true },
    });
  }

  async _fail(execution, error, fallbackCode) {
    const refreshed = await this._refresh(execution.id);
    if (refreshed.status === EXECUTION_STATUS.CANCEL_REQUESTED) {
      return this._cancelTerminal(refreshed);
    }
    const code = error.code || fallbackCode || "EXECUTION_FAILED";
    const message = boundedString(error.message || "Execution failed.");
    let current = refreshed;
    if (current.status !== EXECUTION_STATUS.CLASSIFYING_FAILURE &&
        ![EXECUTION_STATUS.REPAIR_PENDING, EXECUTION_STATUS.REPAIRING].includes(current.status)) {
      if (current.status === EXECUTION_STATUS.COLLECTING_ARTIFACTS || current.status === EXECUTION_STATUS.RUNNING) {
        current = await this._transition(current, EXECUTION_STATUS.CLASSIFYING_FAILURE, {
          eventType: "EXECUTION_FAILURE_CLASSIFICATION_STARTED",
        });
      }
    }
    const classification = classifyFailure({ errorCode: code, message });
    current = await this.repository.updateExecution(current.id, {
      failureClassification: classification,
      failureCode: code,
      failureMessage: message,
      updatedAt: nowIso(this.clock),
    }, current.statusVersion);
    await this._appendEvent(current, "EXECUTION_FAILURE_RECORDED", {
      code,
      message,
      classification,
      details: safeJsonValue(error.details),
    });
    if (isBlockingEnvironmentFailure(classification) &&
        current.status !== EXECUTION_STATUS.REPAIR_PENDING &&
        current.status !== EXECUTION_STATUS.REPAIRING) {
      return this._transition(current, EXECUTION_STATUS.BLOCKED, {
        eventType: "EXECUTION_BLOCKED",
        patch: { finishedAt: nowIso(this.clock) },
      });
    }
    return this._transition(current, EXECUTION_STATUS.FAILED, {
      eventType: "EXECUTION_FAILED",
      patch: { finishedAt: nowIso(this.clock) },
    });
  }

  async _block(execution, error, fallbackCode) {
    const refreshed = await this._refresh(execution.id);
    if (refreshed.status === EXECUTION_STATUS.CANCEL_REQUESTED) {
      return this._cancelTerminal(refreshed);
    }
    const code = error.code || fallbackCode || "EXECUTION_BLOCKED";
    const message = boundedString(error.message || "Execution is blocked.");
    const updated = await this.repository.updateExecution(refreshed.id, {
      failureClassification: classifyFailure({ errorCode: code, message }),
      failureCode: code,
      failureMessage: message,
      updatedAt: nowIso(this.clock),
    }, refreshed.statusVersion);
    await this._appendEvent(updated, "EXECUTION_BLOCKER_RECORDED", {
      code,
      message,
      details: safeJsonValue(error.details),
    });
    if (updated.status === EXECUTION_STATUS.BLOCKED) return updated;
    return this._transition(updated, EXECUTION_STATUS.BLOCKED, {
      eventType: "EXECUTION_BLOCKED",
      patch: { finishedAt: nowIso(this.clock) },
    });
  }
}

module.exports = {
  RECOVERABLE_STATUSES,
  ExecutionLifecycleError,
  ExecutionLifecycleOrchestrator,
  safeJsonValue,
};
