const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "User",
    {
      UserId: {
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
      RoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Role",
          key: "RoleId",
        },
      },
      Username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      Email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      Password: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      PhoneNo: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      Firstname: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      Lastname: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      AccessToken: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      RefreshToken: {
        type: DataTypes.STRING(255),
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
      tableName: "User",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_U_UserId",
          unique: true,
          fields: [{ name: "UserId" }],
        },
      ],
    }
  );
};
