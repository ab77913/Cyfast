"use strict";

module.exports = function (sequelize, DataTypes) {
  const GeneratedTestCase = sequelize.define(
    "GeneratedTestCase",
    {
      generated_test_case_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      job_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      requirement_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      test_scenario_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      scenario_title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      test_case_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      test_case_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      test_case_description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      test_type: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      preconditions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      test_steps: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      test_data: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expected_result: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      automation_percentage: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "PENDING",
      },
      promoted_test_case_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      approved_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejected_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      source_payload: {
        type: DataTypes.JSON,
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
      modified_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      modified_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      deleted_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "generated_test_case",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    },
  );

  GeneratedTestCase.associate = function (models) {
    GeneratedTestCase.belongsTo(models.Job, {
      foreignKey: "job_id",
      as: "job",
    });
    GeneratedTestCase.belongsTo(models.Requirement, {
      foreignKey: "requirement_id",
      as: "requirement",
    });
    GeneratedTestCase.belongsTo(models.TestScenario, {
      foreignKey: "test_scenario_id",
      as: "test_scenario",
    });
    GeneratedTestCase.belongsTo(models.TestCase, {
      foreignKey: "promoted_test_case_id",
      as: "promoted_test_case",
    });
  };

  return GeneratedTestCase;
};
