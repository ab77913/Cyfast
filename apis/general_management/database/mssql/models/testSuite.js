const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "TestSuite",
    {
      TestSuiteId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
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
      TestSuiteName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      DirectoryName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      DirectoryPath: {
        type: DataTypes.STRING(250),
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
      tableName: "TestSuite",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_TC_TestSuiteId",
          unique: true,
          fields: [{ name: "TestSuiteId" }],
        },
      ],
    }
  );
};
