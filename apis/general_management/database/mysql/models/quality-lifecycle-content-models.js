"use strict";

module.exports = function qualityLifecycleContentModels(sequelize, DataTypes) {
  const QualityLifecycleContent = sequelize.define(
    "QualityLifecycleContent",
    {
      quality_lifecycle_content_id: { type: DataTypes.STRING(64), primaryKey: true },
      quality_lifecycle_id: { type: DataTypes.STRING(64), allowNull: false },
      quality_lifecycle_item_id: { type: DataTypes.STRING(64), allowNull: false },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      item_type: { type: DataTypes.STRING(64), allowNull: false },
      resource_id: { type: DataTypes.STRING(128), allowNull: false },
      resource_version: { type: DataTypes.STRING(128), allowNull: false },
      title: { type: DataTypes.STRING(512), allowNull: false },
      content_format: { type: DataTypes.STRING(32), allowNull: false },
      content_text: { type: DataTypes.TEXT("long"), allowNull: true },
      content_json: { type: DataTypes.JSON, allowNull: true },
      content_hash: { type: DataTypes.STRING(64), allowNull: false },
      source_hash: { type: DataTypes.STRING(64), allowNull: false },
      schema_version: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "1.0" },
      model_id: { type: DataTypes.STRING(255), allowNull: true },
      prompt_version: { type: DataTypes.STRING(128), allowNull: true },
      generation_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "GENERATED" },
      validation_result: { type: DataTypes.JSON, allowNull: false },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
      modified_by: DataTypes.STRING(100),
      modified_date: DataTypes.DATE,
      deleted_by: DataTypes.STRING(100),
      deleted_date: DataTypes.DATE,
    },
    {
      tableName: "quality_lifecycle_content",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes: [
        { unique: true, fields: ["quality_lifecycle_item_id"], name: "ux_quality_lifecycle_content_item" },
        { unique: true, fields: ["quality_lifecycle_id", "item_type", "resource_id", "resource_version"], name: "ux_quality_lifecycle_content_version" },
        { fields: ["organization_id", "project_id", "item_type", "generation_status"] },
        { fields: ["content_hash"] },
      ],
    },
  );

  return {
    name: "QualityLifecycleContentModels",
    models: { QualityLifecycleContent },
  };
};
