"use strict";

module.exports = function executionTraceModels(sequelize, DataTypes) {
  const ExecutionTraceLink = sequelize.define(
    "ExecutionTraceLink",
    {
      execution_trace_link_id: { type: DataTypes.STRING(64), primaryKey: true },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
      link_type: { type: DataTypes.STRING(32), allowNull: false },
      resource_id: { type: DataTypes.STRING(128), allowNull: false },
      resource_version: { type: DataTypes.STRING(128), allowNull: false, defaultValue: "current" },
      relationship: { type: DataTypes.STRING(64), allowNull: false },
      source_system: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "CYFAST" },
      metadata: { type: DataTypes.JSON, allowNull: false },
      content_hash: { type: DataTypes.STRING(64), allowNull: false },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
    },
    {
      tableName: "execution_trace_link",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: [
            "execution_run_id",
            "link_type",
            "resource_id",
            "resource_version",
            "relationship",
          ],
          name: "ux_execution_trace_link_identity",
        },
        { fields: ["organization_id", "project_id", "link_type", "resource_id"] },
        { fields: ["execution_run_id", "created_date"] },
      ],
    },
  );

  return { name: "ExecutionTraceModels", models: { ExecutionTraceLink } };
};
