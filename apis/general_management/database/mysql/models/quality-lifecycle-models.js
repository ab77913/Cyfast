"use strict";

module.exports = function qualityLifecycleModels(sequelize, DataTypes) {
  const commonOptions = (tableName, indexes = []) => ({
    tableName,
    timestamps: true,
    createdAt: "created_date",
    updatedAt: "modified_date",
    deletedAt: "deleted_date",
    indexes,
  });

  const QualityLifecycle = sequelize.define(
    "QualityLifecycle",
    {
      quality_lifecycle_id: { type: DataTypes.STRING(64), primaryKey: true },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      source_document_file_id: { type: DataTypes.STRING(128), allowNull: false },
      source_document_hash: { type: DataTypes.STRING(64), allowNull: false },
      source_document_version: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "DOCUMENT_UPLOADED" },
      current_stage: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "DOCUMENT" },
      generation_policy: { type: DataTypes.JSON, allowNull: false },
      acceptance_policy: { type: DataTypes.JSON, allowNull: false },
      traceability_complete: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      ready_for_execution: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      active_execution_run_id: DataTypes.STRING(64),
      completed_execution_run_id: DataTypes.STRING(64),
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
      modified_by: DataTypes.STRING(100),
      modified_date: DataTypes.DATE,
      deleted_by: DataTypes.STRING(100),
      deleted_date: DataTypes.DATE,
    },
    commonOptions("quality_lifecycle", [
      { fields: ["organization_id", "project_id", "status", "created_date"] },
      { fields: ["source_document_file_id", "source_document_version"] },
      { fields: ["active_execution_run_id"] },
    ]),
  );

  const QualityLifecycleItem = sequelize.define(
    "QualityLifecycleItem",
    {
      quality_lifecycle_item_id: { type: DataTypes.STRING(64), primaryKey: true },
      quality_lifecycle_id: { type: DataTypes.STRING(64), allowNull: false },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      item_type: { type: DataTypes.STRING(64), allowNull: false },
      resource_id: { type: DataTypes.STRING(128), allowNull: false },
      resource_version: { type: DataTypes.STRING(128), allowNull: false },
      source_item_id: DataTypes.STRING(64),
      source_anchor: { type: DataTypes.JSON, allowNull: false },
      generation_metadata: { type: DataTypes.JSON, allowNull: false },
      approval_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "PENDING" },
      approved_by: DataTypes.STRING(100),
      approved_at: DataTypes.DATE,
      content_hash: { type: DataTypes.STRING(64), allowNull: false },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
      modified_by: DataTypes.STRING(100),
      modified_date: DataTypes.DATE,
      deleted_by: DataTypes.STRING(100),
      deleted_date: DataTypes.DATE,
    },
    commonOptions("quality_lifecycle_item", [
      {
        unique: true,
        fields: ["quality_lifecycle_id", "item_type", "resource_id", "resource_version"],
        name: "ux_quality_lifecycle_item_version",
      },
      { fields: ["organization_id", "project_id", "item_type", "approval_status"] },
      { fields: ["quality_lifecycle_id", "source_item_id"] },
    ]),
  );

  const QualityLifecycleEvent = sequelize.define(
    "QualityLifecycleEvent",
    {
      quality_lifecycle_event_id: { type: DataTypes.STRING(64), primaryKey: true },
      quality_lifecycle_id: { type: DataTypes.STRING(64), allowNull: false },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      sequence_number: { type: DataTypes.BIGINT, allowNull: false },
      event_type: { type: DataTypes.STRING(128), allowNull: false },
      actor_type: { type: DataTypes.STRING(32), allowNull: false },
      actor_id: DataTypes.STRING(100),
      payload: { type: DataTypes.JSON, allowNull: false },
      payload_hash: { type: DataTypes.STRING(64), allowNull: false },
      occurred_at: { type: DataTypes.DATE, allowNull: false },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
    },
    {
      tableName: "quality_lifecycle_event",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: false,
      indexes: [
        { unique: true, fields: ["quality_lifecycle_id", "sequence_number"], name: "ux_quality_lifecycle_event_sequence" },
        { fields: ["organization_id", "project_id", "event_type", "occurred_at"] },
      ],
    },
  );

  return {
    name: "QualityLifecycleModels",
    models: { QualityLifecycle, QualityLifecycleItem, QualityLifecycleEvent },
  };
};
