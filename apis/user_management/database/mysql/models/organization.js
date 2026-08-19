/**
 * Organization Model
 * @module Organization
 * @description This model represents an organization in the User Management system.
 * It includes fields for organization details, client credentials, and audit information.
 * @requires sequelize
 * @requires DataTypes
 */

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

      name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      domain: {
        type: DataTypes.CHAR(16),
        allowNull: true,
      },
      client_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      client_secret: {
        type: DataTypes.STRING(100),
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
      tableName: "organization",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes: [
        {
          name: "pk_organization_organization_id",
          unique: true,
          fields: [{ name: "organization_id" }],
        },
      ],
    }
  );
};
