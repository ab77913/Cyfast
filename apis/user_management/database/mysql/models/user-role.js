/**
 * UserRole Model
 * @module UserRole
 * @description This model represents the association between users and roles in the User Management system.
 * It includes fields for user and role IDs, along with audit information.
 * @requires sequelize
 * @requires DataTypes
 */

module.exports = function (sequelize, DataTypes) {
  const UserRole = sequelize.define(
    "UserRole",
    {
      user_role_id: { 
        autoIncrement: true, 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        primaryKey: true 
      },
      organization_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        references: { 
          model: "Organization", 
          key: "organization_id" 
        } 
      },
      user_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        references: { 
          model: "User", 
          key: "user_id" 
        } 
      },
      role_id: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        references: { 
          model: "Role", 
          key: "role_id" 
        } 
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
      tableName: "user_role",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  UserRole.associate = (db) => {
    UserRole.belongsTo(db.User, { foreignKey: "user_id" });
    UserRole.belongsTo(db.Role, { foreignKey: "role_id" });
  };

  return UserRole;
};
