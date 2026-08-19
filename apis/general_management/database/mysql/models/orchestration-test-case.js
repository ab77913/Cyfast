const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const OrchestrationTestCase = sequelize.define(
    "OrchestrationTestCase",
    {
      orchestration_test_case_id: {
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

      test_script_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      test_case_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      test_case_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      execution_order: {
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
      tableName: "orchestration_test_case",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Associations
  OrchestrationTestCase.associate = (models) => {
    OrchestrationTestCase.belongsTo(models.TestCase, {
      as: "test_case",
      foreignKey: "test_case_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    OrchestrationTestCase.belongsTo(models.TestScript, {
      as: "test_script",
      foreignKey: "test_script_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
  };

  return OrchestrationTestCase;
};
