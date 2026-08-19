const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "Project",
    {
      project_id: {
        autoIncrement: true,
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Organization", // Ensure this refers to the Organization model
          key: "organization_id",
        },
      },
      ProjectName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      ProjectCode: {
        type: DataTypes.CHAR(10),
        allowNull: false,
      },
      ProjectVersion: {
        type: DataTypes.STRING(16),
        allowNull: true,
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Type: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      status: {
        type: DataTypes.CHAR(16),
        allowNull: true,
      },
      emails_to_notify: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      enable_logging: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      continue_on_error: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
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
      tableName: "Project", // Keep the table name the same
      timestamps: true, // Enable timestamps for createdAt and updatedAt
      createdAt: "created_date", // Map to the appropriate column
      updatedAt: "ModifiedDate", // Map to the appropriate column
      deletedAt: "DeletedDate", // Map to the appropriate column for soft deletes
      indexes: [
        {
          name: "PK_P_project_id",
          unique: true,
          fields: [{ name: "project_id" }],
        },
      ],
    }
  );
};
