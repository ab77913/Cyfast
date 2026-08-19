const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "TraceabilityImport",
    {
      ImportId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      OrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ImportType: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TraceabilityType: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TraceabilityFormat: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      Status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      Filename: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      FileType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      TempPath: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      DocumentNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      DocumentName: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      Author: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      Purpose: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      Version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TotalRecords: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      RecordsImported: {
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
      tableName: "TraceabilityImport",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
    }
  );
};
