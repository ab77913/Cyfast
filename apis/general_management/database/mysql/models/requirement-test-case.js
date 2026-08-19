const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const RequirementTestCase = sequelize.define(
    "RequirementTestCase",
    {
      requirement_test_case_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Project", // Reference to Project model
          key: "project_id",
        },
      },

      requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Requirement", // Reference to Requirement model
          key: "requirement_id",
        },
      },
      requirement_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      test_case_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestCase", // Reference to TestCase model
          key: "test_case_id",
        },
      },
      test_case_version: {
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
      tableName: "requirement_test_case",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  RequirementTestCase.associate = function (models) {
    // Define associations if needed
    RequirementTestCase.belongsTo(models.Requirement, {
      foreignKey: "requirement_id",
      as: "requirement",
    });
    RequirementTestCase.belongsTo(models.TestCase, {
      foreignKey: "test_case_id",
      as: "test_case",
    });
  };

  return RequirementTestCase;
};
