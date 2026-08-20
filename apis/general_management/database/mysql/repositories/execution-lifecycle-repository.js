"use strict";

const { QueryTypes, Transaction } = require("sequelize");

const RUN_COLUMNS = Object.freeze({
  status: ["status", String],
  statusVersion: ["status_version", Number],
  packageSnapshot: ["package_snapshot", JSON.stringify],
  packageSha256: ["package_sha256", String],
  targetSnapshot: ["target_snapshot", JSON.stringify],
  targetId: ["target_id", nullableString],
  repairAttempts: ["repair_attempts", Number],
  attemptNumber: ["attempt_number", Number],
  cancelRequested: ["cancel_requested", booleanNumber],
  cancelRequestedBy: ["cancel_requested_by", nullableString],
  cancelRequestedAt: ["cancel_requested_at", nullableDate],
  runtimeProof: ["runtime_proof", nullableJson],
  runtimeProofVerifiedAt: ["runtime_proof_verified_at", nullableDate],
  resultProof: ["result_proof", nullableJson],
  lastResult: ["last_result", nullableJson],
  artifactCount: ["artifact_count", Number],
  failureClassification: ["failure_classification", nullableString],
  failureCode: ["failure_code", nullableString],
  failureMessage: ["failure_message", nullableString],
  defectId: ["defect_id", nullableString],
  startedAt: ["started_at", nullableDate],
  finishedAt: ["finished_at", nullableDate],
  updatedAt: ["updated_at", requiredDate],
});

function nullableString(value) {
  return value === null || value === undefined ? null : String(value);
}

function booleanNumber(value) {
  return value ? 1 : 0;
}

function requiredDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError("A valid date is required.");
  return date;
}

function nullableDate(value) {
  return value === null || value === undefined ? null : requiredDate(value);
}

function nullableJson(value) {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) value = value.toString("utf8");
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function asDateIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mapRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    platform: row.platform,
    status: row.status,
    statusVersion: Number(row.status_version),
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    requirementId: row.requirement_id,
    scenarioId: row.scenario_id,
    testCaseId: row.test_case_id,
    testScriptId: row.test_script_id,
    packageSnapshot: parseJson(row.package_snapshot),
    packageSha256: row.package_sha256,
    targetSnapshot: parseJson(row.target_snapshot),
    targetId: row.target_id,
    requestedBy: row.requested_by,
    repairAttempts: Number(row.repair_attempts || 0),
    attemptNumber: Number(row.attempt_number || 0),
    cancelRequested: Boolean(row.cancel_requested),
    cancelRequestedBy: row.cancel_requested_by,
    cancelRequestedAt: asDateIso(row.cancel_requested_at),
    runtimeProof: parseJson(row.runtime_proof),
    runtimeProofVerifiedAt: asDateIso(row.runtime_proof_verified_at),
    resultProof: parseJson(row.result_proof),
    lastResult: parseJson(row.last_result),
    artifactCount: Number(row.artifact_count || 0),
    failureClassification: row.failure_classification,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    defectId: row.defect_id,
    startedAt: asDateIso(row.started_at),
    finishedAt: asDateIso(row.finished_at),
    createdAt: asDateIso(row.created_at),
    updatedAt: asDateIso(row.updated_at),
  };
}

function mapEvent(row) {
  return row ? {
    id: row.id,
    executionId: row.execution_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    sequence: Number(row.sequence),
    type: row.event_type,
    status: row.status,
    details: parseJson(row.details),
    createdAt: asDateIso(row.created_at),
  } : null;
}

function mapArtifact(row) {
  return row ? {
    id: row.id,
    executionId: row.execution_id,
    attemptNumber: Number(row.attempt_number),
    organizationId: row.organization_id,
    projectId: row.project_id,
    type: row.artifact_type,
    fileName: row.file_name,
    contentType: row.content_type,
    size: Number(row.size_bytes),
    sha256: row.sha256,
    storageReference: row.storage_reference,
    downloadReference: row.download_reference,
    expiresAt: asDateIso(row.expires_at),
    createdAt: asDateIso(row.created_at),
  } : null;
}

function affectedRows(result) {
  if (typeof result === "number") return result;
  if (Array.isArray(result)) {
    for (const value of result) {
      if (typeof value === "number") return value;
      if (value && Number.isFinite(Number(value.affectedRows))) return Number(value.affectedRows);
    }
  }
  if (result && Number.isFinite(Number(result.affectedRows))) return Number(result.affectedRows);
  return 0;
}

class ExecutionLifecycleRepository {
  constructor({ sequelize, clock = () => new Date() } = {}) {
    if (!sequelize || typeof sequelize.query !== "function") {
      throw new TypeError("A Sequelize-compatible connection is required.");
    }
    this.sequelize = sequelize;
    this.clock = clock;
  }

  async createExecution(execution) {
    const replacements = {
      id: execution.id,
      organizationId: execution.organizationId,
      projectId: execution.projectId,
      platform: execution.platform,
      status: execution.status,
      statusVersion: execution.statusVersion,
      idempotencyKey: execution.idempotencyKey,
      correlationId: execution.correlationId,
      requirementId: execution.requirementId,
      scenarioId: execution.scenarioId,
      testCaseId: execution.testCaseId,
      testScriptId: execution.testScriptId,
      packageSnapshot: JSON.stringify(execution.packageSnapshot),
      packageSha256: execution.packageSha256,
      targetSnapshot: JSON.stringify(execution.targetSnapshot),
      targetId: execution.targetId,
      requestedBy: execution.requestedBy,
      repairAttempts: execution.repairAttempts || 0,
      attemptNumber: execution.attemptNumber || 0,
      cancelRequested: booleanNumber(execution.cancelRequested),
      createdAt: requiredDate(execution.createdAt),
      updatedAt: requiredDate(execution.updatedAt),
    };

    try {
      await this.sequelize.query(`
        INSERT INTO execution_runs (
          id, organization_id, project_id, platform, status, status_version,
          idempotency_key, correlation_id, requirement_id, scenario_id,
          test_case_id, test_script_id, package_snapshot, package_sha256,
          target_snapshot, target_id, requested_by, repair_attempts,
          attempt_number, cancel_requested, created_at, updated_at
        ) VALUES (
          :id, :organizationId, :projectId, :platform, :status, :statusVersion,
          :idempotencyKey, :correlationId, :requirementId, :scenarioId,
          :testCaseId, :testScriptId, CAST(:packageSnapshot AS JSON), :packageSha256,
          CAST(:targetSnapshot AS JSON), :targetId, :requestedBy, :repairAttempts,
          :attemptNumber, :cancelRequested, :createdAt, :updatedAt
        )
      `, { replacements });
    } catch (error) {
      if (error?.original?.code === "ER_DUP_ENTRY" || error?.parent?.code === "ER_DUP_ENTRY") {
        const existing = await this.findByIdempotencyKey(execution);
        if (existing) return existing;
      }
      throw error;
    }
    return this.getExecution(execution.id);
  }

  async getExecution(id, scope = {}) {
    const where = ["id = :id"];
    const replacements = { id };
    if (scope.organizationId) {
      where.push("organization_id = :organizationId");
      replacements.organizationId = scope.organizationId;
    }
    if (scope.projectId) {
      where.push("project_id = :projectId");
      replacements.projectId = scope.projectId;
    }
    const rows = await this.sequelize.query(
      `SELECT * FROM execution_runs WHERE ${where.join(" AND ")} LIMIT 1`,
      { replacements, type: QueryTypes.SELECT },
    );
    return mapRun(rows[0]);
  }

  async findByIdempotencyKey({ organizationId, projectId, idempotencyKey }) {
    const rows = await this.sequelize.query(`
      SELECT *
      FROM execution_runs
      WHERE organization_id = :organizationId
        AND project_id = :projectId
        AND idempotency_key = :idempotencyKey
      LIMIT 1
    `, {
      replacements: { organizationId, projectId, idempotencyKey },
      type: QueryTypes.SELECT,
    });
    return mapRun(rows[0]);
  }

  async updateExecution(id, patch, expectedStatusVersion) {
    const assignments = [];
    const replacements = { id };
    for (const [property, value] of Object.entries(patch || {})) {
      const definition = RUN_COLUMNS[property];
      if (!definition) continue;
      const [column, convert] = definition;
      assignments.push(`${column} = :${property}`);
      replacements[property] = convert(value);
    }
    if (assignments.length === 0) return this.getExecution(id);

    const where = ["id = :id"];
    if (expectedStatusVersion !== undefined && expectedStatusVersion !== null) {
      where.push("status_version = :expectedStatusVersion");
      replacements.expectedStatusVersion = Number(expectedStatusVersion);
    }

    const result = await this.sequelize.query(
      `UPDATE execution_runs SET ${assignments.join(", ")} WHERE ${where.join(" AND ")}`,
      { replacements },
    );
    if (expectedStatusVersion !== undefined && affectedRows(result) !== 1) {
      const error = new Error("Execution was modified by another worker.");
      error.code = "EXECUTION_VERSION_CONFLICT";
      error.statusCode = 409;
      throw error;
    }
    return this.getExecution(id);
  }

  async appendEvent(event) {
    return this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    }, async (transaction) => {
      const runRows = await this.sequelize.query(`
        SELECT id, organization_id, project_id, status
        FROM execution_runs
        WHERE id = :executionId
        FOR UPDATE
      `, {
        replacements: { executionId: event.executionId },
        type: QueryTypes.SELECT,
        transaction,
      });
      const run = runRows[0];
      if (!run) {
        const error = new Error("Execution was not found while appending an event.");
        error.code = "EXECUTION_NOT_FOUND";
        throw error;
      }
      const sequenceRows = await this.sequelize.query(`
        SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
        FROM execution_events
        WHERE execution_id = :executionId
      `, {
        replacements: { executionId: event.executionId },
        type: QueryTypes.SELECT,
        transaction,
      });
      const sequence = Number(sequenceRows[0]?.next_sequence || 1);
      const createdAt = requiredDate(event.createdAt || this.clock());
      await this.sequelize.query(`
        INSERT INTO execution_events (
          id, execution_id, organization_id, project_id,
          sequence, event_type, status, details, created_at
        ) VALUES (
          :id, :executionId, :organizationId, :projectId,
          :sequence, :eventType, :status, CAST(:details AS JSON), :createdAt
        )
      `, {
        replacements: {
          id: event.id,
          executionId: event.executionId,
          organizationId: event.organizationId || run.organization_id,
          projectId: event.projectId || run.project_id,
          sequence,
          eventType: event.type,
          status: event.status || run.status,
          details: JSON.stringify(event.details || {}),
          createdAt,
        },
        transaction,
      });
      return {
        ...event,
        organizationId: event.organizationId || run.organization_id,
        projectId: event.projectId || run.project_id,
        status: event.status || run.status,
        sequence,
        createdAt: createdAt.toISOString(),
      };
    });
  }

  async nextEventSequence(executionId) {
    const rows = await this.sequelize.query(`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
      FROM execution_events
      WHERE execution_id = :executionId
    `, {
      replacements: { executionId },
      type: QueryTypes.SELECT,
    });
    return Number(rows[0]?.next_sequence || 1);
  }

  async listEvents({ organizationId, projectId, executionId, afterSequence = 0, limit = 200 }) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const rows = await this.sequelize.query(`
      SELECT *
      FROM execution_events
      WHERE organization_id = :organizationId
        AND project_id = :projectId
        AND execution_id = :executionId
        AND sequence > :afterSequence
      ORDER BY sequence ASC
      LIMIT :limit
    `, {
      replacements: {
        organizationId,
        projectId,
        executionId,
        afterSequence: Math.max(0, Number(afterSequence) || 0),
        limit: boundedLimit,
      },
      type: QueryTypes.SELECT,
    });
    return rows.map(mapEvent);
  }

  async listExecutionsByStatus(statuses) {
    if (!Array.isArray(statuses) || statuses.length === 0) return [];
    const rows = await this.sequelize.query(`
      SELECT *
      FROM execution_runs
      WHERE status IN (:statuses)
      ORDER BY updated_at ASC, id ASC
    `, {
      replacements: { statuses },
      type: QueryTypes.SELECT,
    });
    return rows.map(mapRun);
  }

  async listExecutions({ organizationId, projectId, status, platform, page = 1, pageSize = 25 }) {
    const boundedPage = Math.max(1, Number(page) || 1);
    const boundedPageSize = Math.max(1, Math.min(Number(pageSize) || 25, 100));
    const where = ["organization_id = :organizationId", "project_id = :projectId"];
    const replacements = { organizationId, projectId };
    if (status) {
      where.push("status = :status");
      replacements.status = status;
    }
    if (platform) {
      where.push("platform = :platform");
      replacements.platform = platform;
    }
    const countRows = await this.sequelize.query(`
      SELECT COUNT(*) AS total
      FROM execution_runs
      WHERE ${where.join(" AND ")}
    `, { replacements, type: QueryTypes.SELECT });
    const total = Number(countRows[0]?.total || 0);
    const rows = await this.sequelize.query(`
      SELECT *
      FROM execution_runs
      WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT :limit OFFSET :offset
    `, {
      replacements: {
        ...replacements,
        limit: boundedPageSize,
        offset: (boundedPage - 1) * boundedPageSize,
      },
      type: QueryTypes.SELECT,
    });
    return {
      items: rows.map(mapRun),
      pagination: {
        page: boundedPage,
        pageSize: boundedPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / boundedPageSize)),
      },
    };
  }

  async createArtifact(artifact) {
    await this.sequelize.query(`
      INSERT INTO execution_artifacts (
        id, execution_id, attempt_number, organization_id, project_id,
        artifact_type, file_name, content_type, size_bytes, sha256,
        storage_reference, download_reference, expires_at, created_at
      ) VALUES (
        :id, :executionId, :attemptNumber, :organizationId, :projectId,
        :artifactType, :fileName, :contentType, :sizeBytes, :sha256,
        :storageReference, :downloadReference, :expiresAt, :createdAt
      )
    `, {
      replacements: {
        id: artifact.id,
        executionId: artifact.executionId,
        attemptNumber: artifact.attemptNumber,
        organizationId: artifact.organizationId,
        projectId: artifact.projectId,
        artifactType: artifact.type,
        fileName: artifact.fileName,
        contentType: artifact.contentType,
        sizeBytes: artifact.size,
        sha256: artifact.sha256,
        storageReference: artifact.storageReference,
        downloadReference: artifact.downloadReference || null,
        expiresAt: nullableDate(artifact.expiresAt),
        createdAt: requiredDate(artifact.createdAt || this.clock()),
      },
    });
    return this.getArtifact(artifact.id, artifact);
  }

  async getArtifact(id, scope = {}) {
    const where = ["id = :id"];
    const replacements = { id };
    if (scope.organizationId) {
      where.push("organization_id = :organizationId");
      replacements.organizationId = scope.organizationId;
    }
    if (scope.projectId) {
      where.push("project_id = :projectId");
      replacements.projectId = scope.projectId;
    }
    const rows = await this.sequelize.query(
      `SELECT * FROM execution_artifacts WHERE ${where.join(" AND ")} LIMIT 1`,
      { replacements, type: QueryTypes.SELECT },
    );
    return mapArtifact(rows[0]);
  }

  async listArtifacts({ organizationId, projectId, executionId, attemptNumber }) {
    const where = [
      "organization_id = :organizationId",
      "project_id = :projectId",
      "execution_id = :executionId",
    ];
    const replacements = { organizationId, projectId, executionId };
    if (attemptNumber !== undefined && attemptNumber !== null) {
      where.push("attempt_number = :attemptNumber");
      replacements.attemptNumber = Number(attemptNumber);
    }
    const rows = await this.sequelize.query(`
      SELECT *
      FROM execution_artifacts
      WHERE ${where.join(" AND ")}
      ORDER BY attempt_number ASC, created_at ASC, id ASC
    `, { replacements, type: QueryTypes.SELECT });
    return rows.map(mapArtifact);
  }

  async upsertAttempt(attempt) {
    await this.sequelize.query(`
      INSERT INTO execution_attempts (
        id, execution_id, organization_id, project_id, attempt_number,
        package_sha256, status, runtime_proof, result_proof, raw_result,
        failure_classification, failure_code, failure_message,
        started_at, finished_at, created_at, updated_at
      ) VALUES (
        :id, :executionId, :organizationId, :projectId, :attemptNumber,
        :packageSha256, :status, CAST(:runtimeProof AS JSON), CAST(:resultProof AS JSON),
        CAST(:rawResult AS JSON), :failureClassification, :failureCode, :failureMessage,
        :startedAt, :finishedAt, :createdAt, :updatedAt
      ) AS new
      ON DUPLICATE KEY UPDATE
        status = new.status,
        runtime_proof = new.runtime_proof,
        result_proof = new.result_proof,
        raw_result = new.raw_result,
        failure_classification = new.failure_classification,
        failure_code = new.failure_code,
        failure_message = new.failure_message,
        started_at = COALESCE(execution_attempts.started_at, new.started_at),
        finished_at = new.finished_at,
        updated_at = new.updated_at
    `, {
      replacements: {
        id: attempt.id,
        executionId: attempt.executionId,
        organizationId: attempt.organizationId,
        projectId: attempt.projectId,
        attemptNumber: attempt.attemptNumber,
        packageSha256: attempt.packageSha256,
        status: attempt.status,
        runtimeProof: nullableJson(attempt.runtimeProof) || "null",
        resultProof: nullableJson(attempt.resultProof) || "null",
        rawResult: nullableJson(attempt.rawResult) || "null",
        failureClassification: attempt.failureClassification || null,
        failureCode: attempt.failureCode || null,
        failureMessage: attempt.failureMessage || null,
        startedAt: nullableDate(attempt.startedAt),
        finishedAt: nullableDate(attempt.finishedAt),
        createdAt: requiredDate(attempt.createdAt || this.clock()),
        updatedAt: requiredDate(attempt.updatedAt || this.clock()),
      },
    });
  }

  async linkDefect(link) {
    await this.sequelize.query(`
      INSERT INTO execution_defect_links (
        id, execution_id, attempt_number, organization_id,
        project_id, defect_id, failure_classification, created_at
      ) VALUES (
        :id, :executionId, :attemptNumber, :organizationId,
        :projectId, :defectId, :failureClassification, :createdAt
      )
    `, {
      replacements: {
        id: link.id,
        executionId: link.executionId,
        attemptNumber: link.attemptNumber,
        organizationId: link.organizationId,
        projectId: link.projectId,
        defectId: link.defectId,
        failureClassification: link.failureClassification,
        createdAt: requiredDate(link.createdAt || this.clock()),
      },
    });
  }
}

module.exports = {
  ExecutionLifecycleRepository,
  mapRun,
  mapEvent,
  mapArtifact,
  parseJson,
};
