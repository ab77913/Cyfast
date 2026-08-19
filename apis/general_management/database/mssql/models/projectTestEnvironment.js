const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "ProjectTestEnvironment",
    {
      ProjectTestEnvironmentId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project",
          key: "ProjectId",
        },
      },
      TestEnvironmentId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        references: {
          model: "TestEnvironment",
          key: "TestEnvironmentId",
        },
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
      tableName: "ProjectTestEnvironment",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_PTE_ProjectTestEnvironmentId",
          unique: true,
          fields: [{ name: "ProjectTestEnvironmentId" }],
        },
      ],
    }
  );
};
