const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Organization",
    {
      organization_id: {
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
        type: DataTypes.CHAR(16),
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
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ModifiedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ModifiedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      DeletedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      DeletedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "Organization", // Keep the table name the same
      timestamps: true, // Enable timestamps for createdAt and updatedAt
      createdAt: "created_date", // Map to the appropriate column
      updatedAt: "ModifiedDate", // Map to the appropriate column
      deletedAt: "DeletedDate", // Map to the appropriate column for soft deletes
      indexes: [
        {
          name: "PK_ORG_organization_id",
          unique: true,
          fields: [{ name: "organization_id" }],
        },
      ],
    }
  );
};
