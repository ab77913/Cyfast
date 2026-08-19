/**
 * Role Model
 * @module Role
 * @description This model represents roles within an organization in the User Management system.
 * It includes fields for role details, organization association, and audit information.
 * @requires sequelize
 * @requires DataTypes
 */

module.exports = function (sequelize, DataTypes) {
  const Role = sequelize.define(
    "Role",
    {
      role_id: { 
        autoIncrement: true, 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        primaryKey: true 
      },
      organization_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
      },
      name: { 
        type: DataTypes.STRING(100), 
        allowNull: false 
      },
      description: { 
        type: DataTypes.TEXT, 
        allowNull: true 
      },
      parent_role_id: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
      },
      is_active: { 
        type: DataTypes.BOOLEAN, 
        allowNull: false, 
        defaultValue: true 
      },
      created_by: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
      },
      created_date: { 
        type: DataTypes.DATE, 
        allowNull: true 
      },
      modified_by: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
      },
      modified_date: { 
        type: DataTypes.DATE, 
        allowNull: true 
      },
      deleted_by: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
      },
      deleted_date: { 
        type: DataTypes.DATE, 
        allowNull: true 
      },
    },
    {
      sequelize,
      tableName: "role",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes: [
        { name: "pk_role_role_id", 
          unique: true, 
          fields: [{ name: "role_id" }] 
        }
      ],
    }
  );

  Role.associate = (db) => {
    db.Role.belongsToMany(db.User, {
      through: db.UserRole,
      as: "users",
      foreignKey: "role_id",
      otherKey: "user_id",
    });
    db.Role.hasMany(db.UserRole, { foreignKey: "role_id" });
  };

  return Role;
};
