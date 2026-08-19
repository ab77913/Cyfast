const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Organization",
    {
      OrganizationId: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      Name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      Domain: {
        type: DataTypes.CHAR(20),
        allowNull: true,
      },
      ClientId: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ClientSecret: {
        type: DataTypes.STRING(100),
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
      tableName: "Organization",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_ORG_OrganizationId",
          unique: true,
          fields: [{ name: "OrganizationId" }],
        },
      ],
    }
  );
};
