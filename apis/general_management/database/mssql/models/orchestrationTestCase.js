const { MAX } = require("mssql");
const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationTestCase",
    {
      OrchestrationTestCaseId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      OrchestrationId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Orchestration",
          key: "OrchestrationId",
        },
      },
      OrchestrationVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      TestSuiteId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      TestScriptId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      TestCaseId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      TestCaseVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestEnvironmentId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ExecutionOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      CreatedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      CreatedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ModifiedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ModifiedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      DeletedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      DeletedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },

    {
      sequelize,
      tableName: "OrchestrationTestCase",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_PTE_OrchestrationTestCaseId",
          unique: true,
          fields: [{ name: "OrchestrationTestCaseId" }],
        },
      ],
    }
  );
};
