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
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project", // Ensure this refers to the Project model
          key: "project_id",
        },
      },
      TestEnvironmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "TestEnvironment", // Ensure this refers to the TestEnvironment model
          key: "TestEnvironmentId",
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
      tableName: "ProjectTestEnvironment", // Keep the table name the same
      timestamps: true, // Enable timestamps for createdAt and updatedAt
      createdAt: "created_date", // Map to the appropriate column
      updatedAt: "ModifiedDate", // Map to the appropriate column
      deletedAt: "DeletedDate", // Map to the appropriate column for soft deletes
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
