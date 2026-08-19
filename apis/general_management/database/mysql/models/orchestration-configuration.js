const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationConfiguration",
    {
      orchestration_configuration_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      orchestration_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Orchestration",
          key: "orchestration_id",
        },
      },
      orchestration_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      execution_base: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      continue_on_error: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      run_order: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      trigger_criteria: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      scheduled_start_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scheduled_end_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      repeat_interval_unit: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      repeat_interval_value: {
        type: DataTypes.INTEGER,
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
      tableName: "orchestration_configuration",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );
};
