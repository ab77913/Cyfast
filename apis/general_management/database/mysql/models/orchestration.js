module.exports = function (sequelize, DataTypes) {
  const Orchestration = sequelize.define(
    "Orchestration",
    {
      orchestration_id: {
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
        allowNull: false,
        references: {
          model: "Project",
          key: "project_id",
        },
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      completion_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      last_execution_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        references: {
          model: "OrchestrationExecution",
          key: "orchestration_execution_id",
        },
      },
      last_executed: {
        type: DataTypes.DATE,
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
      tableName: "orchestration",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  // Associations
  Orchestration.associate = (models) => {
    Orchestration.belongsTo(models.Project, {
      as: "project",
      foreignKey: "project_id",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    Orchestration.hasOne(models.OrchestrationConfiguration, {
      as: "configuration",
      foreignKey: "orchestration_id",
      onDelete: "cascade",
    });
    Orchestration.hasMany(models.OrchestrationCustomConfiguration, {
      as: "custom_configurations",
      foreignKey: "orchestration_id",
      onDelete: "cascade",
    });
    Orchestration.hasMany(models.OrchestrationTestCase, {
      as: "tests",
      foreignKey: "orchestration_id",
      onDelete: "cascade",
    });
    Orchestration.hasMany(models.OrchestrationExecution, {
      as: "executions",
      foreignKey: "orchestration_id",
      onDelete: "cascade",
    });
  };

  return Orchestration;
};
