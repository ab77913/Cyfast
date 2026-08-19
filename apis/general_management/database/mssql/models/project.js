const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Project",
    {
      ProjectId: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      OrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Organization",
          key: "OrganizationId",
        },
      },
      ProjectName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      ProjectCode: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      ProjectVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Type: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      Status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      EmailsToNotify: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      EnableLogging: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      ContinueOnError: {
        type: DataTypes.BOOLEAN,
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
      tableName: "Project",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_P_ProjectId",
          unique: true,
          fields: [{ name: "ProjectId" }],
        },
      ],
    }
  );
};
