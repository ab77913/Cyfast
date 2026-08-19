const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "RequirementTestCase",
    {
      RequirementTestCaseId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      RequirementId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      RequirementVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestCaseId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      TestCaseVersion: {
        type: DataTypes.STRING(20),
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
      tableName: "RequirementTestCase",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_RT_RequirementTestCaseId",
          unique: true,
          fields: [{ name: "RequirementTestCaseId" }],
        },
      ],
    }
  );
};
