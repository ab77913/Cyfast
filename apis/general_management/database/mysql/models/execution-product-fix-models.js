"use strict";

module.exports = function executionProductFixModels(sequelize, DataTypes) {
  const ExecutionProductFix = sequelize.define(
    "ExecutionProductFix",
    {
      execution_product_fix_id: { type: DataTypes.STRING(64), primaryKey: true },
      organization_id: { type: DataTypes.INTEGER, allowNull: false },
      project_id: { type: DataTypes.INTEGER, allowNull: false },
      execution_defect_id: { type: DataTypes.STRING(64), allowNull: false },
      source_execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
      root_execution_run_id: { type: DataTypes.STRING(64), allowNull: false },
      repository_url: { type: DataTypes.STRING(2048), allowNull: false },
      base_branch: { type: DataTypes.STRING(255), allowNull: false },
      fix_branch: { type: DataTypes.STRING(255), allowNull: false },
      pull_request_url: { type: DataTypes.STRING(2048), allowNull: true },
      commit_sha: { type: DataTypes.STRING(64), allowNull: true },
      change_summary: { type: DataTypes.TEXT("long"), allowNull: false },
      risk_assessment: { type: DataTypes.JSON, allowNull: false },
      review_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "PENDING" },
      reviewed_by: DataTypes.STRING(100),
      reviewed_at: DataTypes.DATE,
      deployment_environment: DataTypes.STRING(255),
      deployment_id: DataTypes.STRING(255),
      deployment_version: DataTypes.STRING(255),
      deployment_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "NOT_DEPLOYED" },
      deployed_at: DataTypes.DATE,
      verification_execution_run_id: DataTypes.STRING(64),
      verification_status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "NOT_STARTED" },
      created_by: DataTypes.STRING(100),
      created_date: DataTypes.DATE,
      modified_by: DataTypes.STRING(100),
      modified_date: DataTypes.DATE,
      deleted_by: DataTypes.STRING(100),
      deleted_date: DataTypes.DATE,
    },
    {
      tableName: "execution_product_fix",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes: [
        { unique: true, fields: ["execution_defect_id", "fix_branch"], name: "ux_execution_product_fix_branch" },
        { fields: ["organization_id", "project_id", "review_status", "deployment_status"] },
        { fields: ["root_execution_run_id", "created_date"] },
        { fields: ["verification_execution_run_id"] },
      ],
    },
  );

  return { name: "ExecutionProductFixModels", models: { ExecutionProductFix } };
};
