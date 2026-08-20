"use strict";

module.exports = function platformExecutionModels(sequelize, DataTypes) {
  const audit = {
    created_by: DataTypes.STRING(100),
    created_date: DataTypes.DATE,
    modified_by: DataTypes.STRING(100),
    modified_date: DataTypes.DATE,
    deleted_by: DataTypes.STRING(100),
    deleted_date: DataTypes.DATE,
  };

  const define = (name, tableName, fields, indexes = []) => sequelize.define(
    name,
    { ...fields, ...audit },
    {
      tableName,
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes,
    },
  );

  const tenant = {
    organization_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
  };
  const stringId = (name) => ({ [name]: { type: DataTypes.STRING(64), primaryKey: true } });

  const models = {
    ExecutionTarget: define(
      "ExecutionTarget",
      "execution_target",
      {
        ...stringId("execution_target_id"),
        ...tenant,
        name: { type: DataTypes.STRING(255), allowNull: false },
        platform: { type: DataTypes.STRING(32), allowNull: false },
        endpoint: { type: DataTypes.STRING(2048), allowNull: false },
        credential_reference: { type: DataTypes.STRING(128), allowNull: false },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "OFFLINE" },
        capabilities: { type: DataTypes.JSON, allowNull: false },
        configuration: { type: DataTypes.JSON, allowNull: false },
        last_seen_at: DataTypes.DATE,
        last_health: DataTypes.JSON,
        revoked_at: DataTypes.DATE,
        version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      },
      [
        { fields: ["organization_id", "project_id", "platform", "status"] },
        { unique: true, fields: ["organization_id", "project_id", "name", "deleted_date"], name: "ux_execution_target_scope_name" },
      ],
    ),

    ExecutionRun: define(
      "ExecutionRun",
      "execution_run",
      {
        ...stringId("execution_run_id"),
        ...tenant,
        execution_target_id: { type: DataTypes.STRING(64), allowNull: false },
        test_script_id: { type: DataTypes.STRING(64), allowNull: false },
        test_script_version: DataTypes.STRING(64),
        parent_execution_run_id: DataTypes.STRING(64),
        root_execution_run_id: DataTypes.STRING(64),
        attempt_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        platform: { type: DataTypes.STRING(32), allowNull: false },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "CREATED" },
        correlation_id: { type: DataTypes.STRING(64), allowNull: false },
        idempotency_key: { type: DataTypes.STRING(128), allowNull: false },
        requested_by: { type: DataTypes.STRING(100), allowNull: false },
        external_execution_id: DataTypes.STRING(128),
        package_sha256: DataTypes.STRING(64),
        package_manifest: DataTypes.JSON,
        runtime_snapshot: DataTypes.JSON,
        result_summary: DataTypes.JSON,
        real_execution: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        simulated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        target_connected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        session_created: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        meaningful_actions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        meaningful_assertions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        exit_code: DataTypes.INTEGER,
        failure_classification: DataTypes.STRING(64),
        failure_message: DataTypes.TEXT,
        proof_hash: DataTypes.STRING(64),
        started_at: DataTypes.DATE,
        finished_at: DataTypes.DATE,
        cancelled_at: DataTypes.DATE,
      },
      [
        { unique: true, fields: ["organization_id", "idempotency_key"], name: "ux_execution_run_idempotency" },
        { fields: ["organization_id", "project_id", "status", "created_date"] },
        { fields: ["root_execution_run_id", "attempt_number"] },
        { fields: ["execution_target_id", "status"] },
      ],
    ),

    ExecutionEvent: define(
      "ExecutionEvent",
      "execution_event",
      {
        ...stringId("execution_event_id"),
        ...tenant,
        execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        sequence_number: { type: DataTypes.BIGINT, allowNull: false },
        event_type: { type: DataTypes.STRING(128), allowNull: false },
        actor_type: { type: DataTypes.STRING(32), allowNull: false },
        actor_id: DataTypes.STRING(100),
        payload: { type: DataTypes.JSON, allowNull: false },
        payload_hash: { type: DataTypes.STRING(64), allowNull: false },
        occurred_at: { type: DataTypes.DATE, allowNull: false },
      },
      [
        { unique: true, fields: ["execution_run_id", "sequence_number"], name: "ux_execution_event_sequence" },
        { fields: ["organization_id", "project_id", "event_type", "occurred_at"] },
      ],
    ),

    ExecutionArtifact: define(
      "ExecutionArtifact",
      "execution_artifact",
      {
        ...stringId("execution_artifact_id"),
        ...tenant,
        execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        artifact_type: { type: DataTypes.STRING(64), allowNull: false },
        storage_file_id: { type: DataTypes.STRING(128), allowNull: false },
        filename: { type: DataTypes.STRING(255), allowNull: false },
        content_type: { type: DataTypes.STRING(255), allowNull: false },
        content_hash: { type: DataTypes.STRING(64), allowNull: false },
        size_bytes: { type: DataTypes.BIGINT, allowNull: false },
        retention_classification: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "STANDARD" },
        metadata: DataTypes.JSON,
        captured_at: { type: DataTypes.DATE, allowNull: false },
        expires_at: DataTypes.DATE,
      },
      [
        { unique: true, fields: ["execution_run_id", "artifact_type", "content_hash"], name: "ux_execution_artifact_content" },
        { fields: ["organization_id", "project_id", "artifact_type", "captured_at"] },
      ],
    ),

    ExecutionRecording: define(
      "ExecutionRecording",
      "execution_recording",
      {
        ...stringId("execution_recording_id"),
        ...tenant,
        execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        execution_artifact_id: { type: DataTypes.STRING(64), allowNull: false },
        recording_type: { type: DataTypes.STRING(32), allowNull: false },
        format: { type: DataTypes.STRING(32), allowNull: false },
        redacted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        started_at: { type: DataTypes.DATE, allowNull: false },
        finished_at: { type: DataTypes.DATE, allowNull: false },
        metadata: DataTypes.JSON,
      },
      [
        { fields: ["execution_run_id", "started_at"] },
        { fields: ["organization_id", "project_id", "recording_type"] },
      ],
    ),

    ExecutionDefect: define(
      "ExecutionDefect",
      "execution_defect",
      {
        ...stringId("execution_defect_id"),
        ...tenant,
        execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        root_execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        rerun_execution_run_id: DataTypes.STRING(64),
        requirement_id: DataTypes.STRING(64),
        test_scenario_id: DataTypes.STRING(64),
        test_case_id: DataTypes.STRING(64),
        test_script_id: DataTypes.STRING(64),
        classification: { type: DataTypes.STRING(64), allowNull: false },
        severity: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "MEDIUM" },
        status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "OPEN" },
        title: { type: DataTypes.STRING(512), allowNull: false },
        description: DataTypes.TEXT,
        expected_result: DataTypes.TEXT,
        actual_result: DataTypes.TEXT,
        assigned_to: DataTypes.STRING(100),
        product_repository: DataTypes.STRING(512),
        product_commit: DataTypes.STRING(128),
        product_pull_request: DataTypes.STRING(512),
        resolution: DataTypes.TEXT,
        resolved_at: DataTypes.DATE,
      },
      [
        { fields: ["organization_id", "project_id", "status", "severity"] },
        { fields: ["root_execution_run_id", "classification"] },
      ],
    ),

    ExecutionRepairAttempt: define(
      "ExecutionRepairAttempt",
      "execution_repair_attempt",
      {
        ...stringId("execution_repair_attempt_id"),
        ...tenant,
        execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
        rerun_execution_run_id: DataTypes.STRING(64),
        attempt_number: { type: DataTypes.INTEGER, allowNull: false },
        failure_classification: { type: DataTypes.STRING(64), allowNull: false },
        base_script_version: DataTypes.STRING(64),
        proposed_script_hash: { type: DataTypes.STRING(64), allowNull: false },
        proposed_patch: { type: DataTypes.TEXT("long"), allowNull: false },
        rationale: DataTypes.TEXT,
        validation_result: DataTypes.JSON,
        approval_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "PENDING" },
        approved_by: DataTypes.STRING(100),
        approved_at: DataTypes.DATE,
      },
      [
        { unique: true, fields: ["execution_run_id", "attempt_number"], name: "ux_execution_repair_attempt" },
        { fields: ["organization_id", "project_id", "approval_status"] },
      ],
    ),
  };

  return { name: "PlatformExecutionModels", models };
};
