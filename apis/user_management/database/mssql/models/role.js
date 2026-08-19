const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Role",
    {
      RoleId: {
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
      RoleName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      RoleDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ParentRoleId: {
        type: DataTypes.INTEGER,
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
      tableName: "Role",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_R_RoleId",
          unique: true,
          fields: [{ name: "RoleId" }],
        },
      ],
    }
  );
};
