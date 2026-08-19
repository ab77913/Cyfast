const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestScriptExecution = sequelize.define(
    "TestScriptExecution",
    {
      TestScriptExecutionId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project", // Ensure this model is defined
          key: "project_id",
        },
        // Optional: Add validation or default values if necessary
      },
      orchestration_execution_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        references: {
          model: "OrchestrationExecution", // Ensure this model is defined
          key: "orchestration_execution_id",
        },
      },
      orchestration_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Orchestration", // Ensure this model is defined
          key: "orchestration_id",
        },
      },
      orchestration_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      test_suite_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestSuite", // Ensure this model is defined
          key: "test_suite_id",
        },
      },
      test_script_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestScript", // Ensure this model is defined
          key: "test_script_id",
        },
      },
      TestScriptVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      test_script_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      file_path: {
        type: DataTypes.STRING(255),
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
      result_details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      test_agent_name: {
        type: DataTypes.STRING(50),
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
      tableName: "test_script_execution",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Define associations
  TestScriptExecution.associate = (models) => {
    TestScriptExecution.belongsTo(models.OrchestrationExecution, {
      as: "orchestration_execution",
      foreignKey: "orchestration_execution_id",
    });
    TestScriptExecution.belongsTo(models.Project, {
      as: "project",
      foreignKey: "project_id",
    });
    TestScriptExecution.belongsTo(models.Orchestration, {
      as: "orchestration",
      foreignKey: "orchestration_id",
    });
    TestScriptExecution.belongsTo(models.TestScript, {
      as: "test_script",
      foreignKey: "test_script_id",
    });
  };

  return TestScriptExecution;
};
