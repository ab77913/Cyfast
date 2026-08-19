"use strict";

module.exports = function (sequelize, DataTypes) {
  const GeneratedTestScenario = sequelize.define(
    "GeneratedTestScenario",
    {
      generated_test_scenario_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      job_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requirement_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      scenario_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      scenario_no: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      objective: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      automation_possibility_score: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      automation_rationale: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
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
      expected_results: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      postconditions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dedupe_hash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "PENDING",
      },
      promoted_test_scenario_id: {
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
      tableName: "generated_test_scenario",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
    }
  );

  GeneratedTestScenario.associate = function (models) {
    GeneratedTestScenario.belongsTo(models.Job, {
      foreignKey: "job_id",
      as: "job",
    });
    GeneratedTestScenario.belongsTo(models.Requirement, {
      foreignKey: "requirement_id",
      as: "requirement",
    });
    GeneratedTestScenario.belongsTo(models.TestScenario, {
      foreignKey: "promoted_test_scenario_id",
      as: "promoted_scenario",
    });
  };

  return GeneratedTestScenario;
};
