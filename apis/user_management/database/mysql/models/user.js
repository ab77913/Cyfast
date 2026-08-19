/**
 * User Model
 * @module User
 * @description This model represents a user in the User Management system.
 * It includes fields for user details, organization association, and audit information.
 * @requires sequelize
 * @requires DataTypes
 */

module.exports = function (sequelize, DataTypes) {
  const User = sequelize.define(
    "User",
    {
      user_id: { 
        autoIncrement: true, 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        primaryKey: true 
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { 
          model: "organization", 
          key: "organization_id" 
        },
      },
      username: { 
        type: DataTypes.STRING(100), 
        allowNull: true 
      },
      email: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
      },
      password_hash: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
      },
      phone_no: { 
        type: DataTypes.STRING(20), 
        allowNull: true 
      },
      first_name: { 
        type: DataTypes.STRING(50), 
        allowNull: true 
      },
      last_name: { 
        type: DataTypes.STRING(50), 
        allowNull: true 
      },
      access_token: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
      },
      refresh_token: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
      },
      is_active: { 
        type: DataTypes.BOOLEAN, 
        allowNull: false, 
        defaultValue: true 
      },
      last_login: { 
        type: DataTypes.DATE, 
        allowNull: true 
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
      tableName: "user",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
      indexes: [
        { 
          name: "pk_user_user_id", 
          unique: true, fields: [{ name: "user_id" }] 
        }
      ],
    }
  );

  // Associations
  User.associate = (db) => {
    db.User.belongsToMany(db.Role, {
      through: db.UserRole,
      as: "roles",
      foreignKey: "user_id",
      otherKey: "role_id",
    });
    db.User.hasMany(db.UserRole, { foreignKey: "user_id" });
  };

  return User;
};
