/**
 * Permission Model
 * @module Permission
 * @description This model represents a permission in the User Management system.
 * It includes fields for permission details, organization association, and audit information.
 * @requires sequelize
 * @requires DataTypes
 */

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Permission",
    {
      permission_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Organization",
          key: "organization_id",
        },
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      permission_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      permission_value: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName: "permission",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );
};
