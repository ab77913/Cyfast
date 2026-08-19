module.exports = function (sequelize, DataTypes) {
  const OrchestrationExecution = sequelize.define(
    "OrchestrationExecution",
    {
      orchestration_execution_id: {
        type: DataTypes.STRING(50),
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

      executed_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      build_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      start_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      end_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      elapsed_time: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      pass_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      completion_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      total_tests: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      result_details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      test_agents: {
        type: DataTypes.STRING(512),
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
      tableName: "orchestration_execution",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  OrchestrationExecution.associate = (models) => {
    OrchestrationExecution.belongsTo(models.Orchestration, {
      as: "orchestration",
      foreignKey: "orchestration_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    OrchestrationExecution.hasMany(models.TestCaseExecution, {
      as: "test_case_executions",
      foreignKey: "orchestration_execution_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
  };

  return OrchestrationExecution;
};
