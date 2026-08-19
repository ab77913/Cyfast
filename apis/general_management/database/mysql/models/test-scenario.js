"use strict";

module.exports = function (sequelize, DataTypes) {
  const TestScenario = sequelize.define(
    "TestScenario",
    {
      test_scenario_id: {
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
      scenario_no: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      scenario_type: {
        type: DataTypes.STRING(64),
        allowNull: false,
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
      actual_results: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      postconditions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requirement_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      dedupe_hash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      generated_from_job_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      promoted_from_candidate_id: {
        type: DataTypes.BIGINT,
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
      tableName: "test_scenario",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      paranoid: false,
      deletedAt: false,
    }
  );

  TestScenario.associate = function (models) {
    TestScenario.belongsTo(models.Requirement, {
      foreignKey: "requirement_id",
      as: "requirement",
    });
    TestScenario.belongsTo(models.Job, {
      foreignKey: "generated_from_job_id",
      as: "generation_job",
    });
  };

  return TestScenario;
};
