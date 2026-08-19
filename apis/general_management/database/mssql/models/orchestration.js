module.exports = function (sequelize, DataTypes) {
  const Orchestration = sequelize.define(
    "Orchestration",
    {
      OrchestrationId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      OrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project",
          key: "ProjectId",
        },
      },
      OrchestrationName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      OrchestrationCode: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      OrchestrationVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      EmailsToNotify: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ContinueOnError: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      RunOrder: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TriggerCriteria: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      ScheduledStartTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ScheduledEndTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ExecutionBase: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      Status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      StatusPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      LastExecuted: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: "Orchestration",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_P_OrchestrationId",
          unique: true,
          fields: [{ name: "OrchestrationId" }],
        },
      ],
    }
  );
  Orchestration.associate = (models) => {
    Orchestration.belongsTo(models.Project, {
      as: "Project",
      foreignKey: "ProjectId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    Orchestration.hasMany(models.OrchestrationConfiguration, {
      as: "OrchestrationConfigurations",
      foreignKey: "OrchestrationId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    Orchestration.hasMany(models.OrchestrationTestCase, {
      as: "OrchestrationTestCases",
      foreignKey: "OrchestrationId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    Orchestration.hasMany(models.OrchestrationExecution, {
      as: "OrchestrationExecutions",
      foreignKey: "OrchestrationId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
  };

  return Orchestration;
};
