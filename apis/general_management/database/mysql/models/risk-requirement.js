const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const RiskRequirement = sequelize.define(
    "RiskRequirement",
    {
      risk_requirement_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "Project", // Reference to Project model
          key: "project_id",
        },
      },

      risk_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Risk", // Reference to Risk model
          key: "risk_id",
        },
      },
      risk_version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: "Requirement", // Reference to Requirement model
          key: "requirement_id",
        },
      },
      requirement_version: {
        type: DataTypes.STRING(20),
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
      tableName: "risk_requirement",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Define associations here if needed
  RiskRequirement.associate = function (models) {
    RiskRequirement.belongsTo(models.Risk, {
      foreignKey: "risk_id",
      as: "risk",
    });
    RiskRequirement.belongsTo(models.Requirement, {
      foreignKey: "requirement_id",
      as: "requirement",
    });
  };

  return RiskRequirement;
};
