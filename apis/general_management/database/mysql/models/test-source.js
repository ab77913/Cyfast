const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const TestSource = sequelize.define(
    "TestSource",
    {
      test_source_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Project",
          key: "project_id",
        },
      },

      source_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      source_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      source_path: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      source_cloud_url: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      repository_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      repository_server_url: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      repository_branch_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      suite_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      access_username: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      access_password: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      access_token: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      test_framework: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      test_scripts_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      test_cases_count: {
        type: DataTypes.INTEGER,
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
      tableName: "test_source",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  return TestSource;
};
