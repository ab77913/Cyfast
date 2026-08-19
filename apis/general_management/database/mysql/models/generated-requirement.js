module.exports = function (sequelize, DataTypes) {
  const GeneratedRequirement = sequelize.define(
    "GeneratedRequirement",
    {
      generated_requirement_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      job_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      requirement_category: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      requirement_no: {
        type: DataTypes.STRING(64),
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
      rationale: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "PENDING",
      },
      promoted_requirement_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      approved_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejected_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      modified_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "generated_requirement",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
    }
  );

  GeneratedRequirement.associate = function (models) {
      GeneratedRequirement.belongsTo(models.Job, {
        foreignKey: "job_id",
        as: "job",
      });
    GeneratedRequirement.belongsTo(models.Requirement, {
      foreignKey: "promoted_requirement_id",
      as: "promoted_requirement",
    });
  };

  return GeneratedRequirement;
};
