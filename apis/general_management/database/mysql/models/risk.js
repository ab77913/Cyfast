const { traceDeprecation } = require("process");
const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const Risk = sequelize.define(
    "Risk",
    {
      risk_id: {
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
          model: "Project", // Reference to Project model
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
      risk_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: "VersionedRisk", // Unique constraint
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: "VersionedRisk", // Unique constraint
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      rpn_number: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      severity: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      occurence: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      detection: {
        type: DataTypes.SMALLINT,
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
      tableName: "risk",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  Risk.associate = function (models) {
    Risk.hasMany(models.RiskRequirement, {
      foreignKey: "risk_id",
      as: "risk_requirements",
      onDelete: "CASCADE",
    });
    // Additional associations can be added here
  };

  return Risk;
};
