"use strict";

const { JOB_TYPES } = require("../../../constants/job-types");

module.exports = function (sequelize, DataTypes) {
  const Job = sequelize.define(
    "Job",
    {
      job_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      job_type: {
        type: DataTypes.STRING(48),
        allowNull: false,
        defaultValue: JOB_TYPES.REQUIREMENT_GENERATION,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "PROCESSING",
      },
      requirement_categories: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      source_document_ids: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      scenario_types: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      scenario_requirement_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      scenario_safety_options: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      test_case_scenario_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      additional_instructions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      user_feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      previous_job_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      raw_llm_response: {
        type: DataTypes.TEXT("medium"),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      modified_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "job",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
    },
  );

  Job.associate = function (models) {
    Job.hasMany(models.GeneratedRequirement, {
      foreignKey: "job_id",
      as: "candidates",
      onDelete: "CASCADE",
    });
    Job.hasMany(models.GeneratedTestScenario, {
      foreignKey: "job_id",
      as: "scenario_candidates",
      onDelete: "CASCADE",
    });
    Job.hasMany(models.GeneratedTestCase, {
      foreignKey: "job_id",
      as: "test_case_candidates",
      onDelete: "CASCADE",
    });
  };

  return Job;
};
