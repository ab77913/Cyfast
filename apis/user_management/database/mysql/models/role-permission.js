/**
 * RolePermission Model
 * @module RolePermission
 * @description This model represents the association between roles and permissions in the User Management system.
 * It includes fields for role and permission IDs, along with audit information.
 * @requires sequelize
 * @requires DataTypes
 */

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "RolePermission",
    {
      role_permission_id: {
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

      role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Role",
          key: "role_id",
        },
      },
      permission_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Permission",
          key: "permission_id",
        },
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
      tableName: "role_permission",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );
};
