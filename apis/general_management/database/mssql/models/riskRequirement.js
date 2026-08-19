const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "RiskRequirement",
    {
      RiskRequirementId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      RiskId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      RiskVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      RequirementId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      RequirementVersion: {
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
      tableName: "RiskRequirement",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_RR_RiskRequirementId",
          unique: true,
          fields: [{ name: "RiskRequirementId" }],
        },
      ],
    }
  );
};
