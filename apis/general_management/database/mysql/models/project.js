const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const Project = sequelize.define(
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
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensures the field is not empty
        },
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      build_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      phase: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: "NOT_EXECUTED", // Default status
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
      tableName: "project",
      // schema: "dbo",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  Project.associate = (models) => {
    Project.hasOne(models.ProjectConfiguration, {
      as: "configuration",
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    Project.hasMany(models.ProjectCustomConfiguration, {
      as: "custom_configurations",
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    Project.hasMany(models.ProjectUser, {
      as: "users",
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
    Project.hasMany(models.ProjectTestAgent, {
      as: "test_agents",
      foreignKey: "project_id",
      onDelete: "CASCADE",
    });
  };

  return Project;
};
