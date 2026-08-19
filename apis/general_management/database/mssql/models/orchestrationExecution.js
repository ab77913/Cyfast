module.exports = function (sequelize, DataTypes) {
  const OrchestrationExecution = sequelize.define(
    "OrchestrationExecution",
    {
      OrchestrationExecutionId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      OrchestrationId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "Orchestration",
          key: "OrchestrationId",
        },
      },
      OrchestrationVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      UserId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      BuildVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      StartTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      EndTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ElapsedTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      Status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      PassPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      CompletionPercentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },
      ResultDetails: {
        type: DataTypes.TEXT,
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
      tableName: "OrchestrationExecution",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_PTE_OrchestrationExecutionId",
          unique: true,
          fields: [{ name: "OrchestrationExecutionId" }],
        },
      ],
    }
  );

  OrchestrationExecution.associate = (models) => {
    OrchestrationExecution.belongsTo(models.Orchestration, {
      as: "Orchestration",
      foreignKey: "OrchestrationId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
    OrchestrationExecution.hasMany(models.TestCaseExecution, {
      as: "TestCaseExecutions",
      foreignKey: "OrchestrationExecutionId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
  };

  return OrchestrationExecution;
};
