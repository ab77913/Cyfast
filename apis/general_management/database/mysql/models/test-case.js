const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestCase = sequelize.define(
    "TestCase",
    {
      test_case_id: {
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
          model: "TestSuite", // Reference to TestSuite model
          key: "test_suite_id",
        },
      },
      test_script_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestScript", // Reference to TestScript model
          key: "test_script_id",
        },
      },

      test_case_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tags: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      pre_condition: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      post_condition: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expected_result: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      test_data: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
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
      tableName: "test_case",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Define associations
  TestCase.associate = (models) => {
    TestCase.belongsTo(models.TestSuite, {
      as: "test_suite",
      foreignKey: "test_suite_id",
      onDelete: "CASCADE",
    });
    TestCase.belongsTo(models.TestScript, {
      as: "test_script",
      foreignKey: "test_script_id",
      onDelete: "CASCADE",
    });
    TestCase.belongsTo(models.Project, {
      as: "project",
      foreignKey: "project_id",
      onDelete: "SET NULL",
    });
    TestCase.hasMany(models.RequirementTestCase, {
      as: "requirement_test_cases",
      foreignKey: "test_case_id",
      onDelete: "CASCADE",
    });
  };

  return TestCase;
};
