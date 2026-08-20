"use strict";

module.exports = function qualityLifecycleExecutionModels(sequelize, DataTypes) {
  const QualityLifecycleExecutionLink = sequelize.define(
    "QualityLifecycleExecutionLink",
    {
      quality_lifecycle_execution_link_id: { type: DataTypes.STRING(64), primaryKey: true },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      quality_lifecycle_id: { type: DataTypes.STRING(64), allowNull: false },
      execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
      root_execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
      relationship: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "PRIMARY" },
      status_snapshot: { type: DataTypes.STRING(32), allowNull: false },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
      modified_by: DataTypes.STRING(100),
      modified_date: DataTypes.DATE,
    },
    {
      tableName: "quality_lifecycle_execution_link",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      indexes: [
        { unique: true, fields: ["quality_lifecycle_id", "execution_run_id"], name: "ux_quality_lifecycle_execution_link" },
        { fields: ["organization_id", "project_id", "quality_lifecycle_id", "status_snapshot"] },
        { fields: ["root_execution_run_id", "created_date"] },
      ],
    },
  );
  return {
    name: "QualityLifecycleExecutionModels",
    models: { QualityLifecycleExecutionLink },
  };
};
