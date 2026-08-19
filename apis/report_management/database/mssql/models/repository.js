const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Repository",
    {
      RepositoryId: {
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
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Organization",
          key: "OrganizationId",
        },
      },
      RepositoryVersion: {
        type: DataTypes.CHAR(16),
        allowNull: true,
      },
      RepositoryType: {
        type: DataTypes.CHAR(16),
        allowNull: false,
      },
      RepositoryName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      AccountType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      UrlType: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      Url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      Port: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      Branch: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      DirectoryName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      Username: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      Password: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      SshKey: {
        type: DataTypes.STRING(1024),
        allowNull: true,
      },
      Token: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      CreatedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      CreatedDate: {
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
      tableName: "Repository",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_R_RepositoryId",
          unique: true,
          fields: [{ name: "RepositoryId" }],
        },
      ],
    }
  );
};
