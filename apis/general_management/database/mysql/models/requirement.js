module.exports = function (sequelize, DataTypes) {
  const Requirement = sequelize.define(
    "Requirement",
    {
      requirement_id: {
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
        allowNull: true, // Change to false if this is a mandatory field
        references: {
          model: "Project", // Add if referencing another model
          key: "project_id",
        },
      },
      traceability_import_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "TraceabilityImport", // Reference to TraceabilityImport model
          key: "traceability_import_id",
        },
      },

      requirement_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: true,
        defaultValue: "ACTIVE",
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
      tableName: "requirement",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  Requirement.associate = function (models) {
    Requirement.hasMany(models.RequirementTestCase, {
      foreignKey: "requirement_id",
      as: "requirement_test_cases",
      onDelete: "CASCADE",
    });
  };

  return Requirement;
};
