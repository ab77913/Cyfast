const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestScript = sequelize.define(
    "TestScript",
    {
      test_script_id: {
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
        allowNull: true,
        references: {
          model: "Project", // Ensure this model is defined
          key: "project_id",
        },
      },
      test_source_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "TestSource", // Ensure this model is defined
          key: "test_source_id",
        },
      },
      test_suite_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestSuite", // Ensure this model is defined
          key: "test_suite_id",
        },
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      file_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      language: {
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
      tableName: "test_script",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Define associations
  TestScript.associate = (models) => {
    TestScript.belongsTo(models.TestSuite, {
      as: "test_suites",
      foreignKey: "test_suite_id",
      // Optional: Define onUpdate behavior if necessary
    });
    TestScript.hasMany(models.TestCase, {
      as: "test_cases",
      foreignKey: "test_script_id",
      onDelete: "CASCADE", // Ensures that deleting a TestScript deletes associated TestCases
    });
    TestScript.belongsTo(models.Project, {
      as: "project",
      foreignKey: "project_id",
      onDelete: "SET NULL", // Optional: Define onDelete behavior if necessary
    });
    TestScript.hasMany(models.TestScriptExecution, {
      as: "test_script_executions",
      foreignKey: "test_script_id",
      onDelete: "CASCADE", // Ensures that deleting a TestScript deletes associated TestScriptExecutions
    });
    // Optional: Define other associations if necessary
  };

  return TestScript;
};
