const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestCaseExecution = sequelize.define(
    "TestCaseExecution",
    {
      test_case_execution_id: {
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
      },
      test_script_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      test_case_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestCase", // Ensure this model is defined
          key: "test_case_id",
        },
      },
      test_case_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      test_case_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      test_case_name: {
        type: DataTypes.STRING(255),
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
        // Optional: Add validation or enum if needed
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
      tableName: "test_case_execution",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Define associations
  TestCaseExecution.associate = (models) => {
    TestCaseExecution.belongsTo(models.OrchestrationExecution, {
      as: "orchestration_execution",
      foreignKey: "orchestration_execution_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    // Optional: Define other associations if necessary
  };

  return TestCaseExecution;
};
