module.exports = function (sequelize, DataTypes) {
  const TestScriptExecution = sequelize.define(
    "TestScriptExecution",
    {
      TestScriptExecutionId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project",
          key: "ProjectId",
        },
      },
      OrchestrationExecutionId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        references: {
          model: "OrchestrationExecution",
          key: "OrchestrationExecutionId",
        },
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
      TestSuiteId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestSuite",
          key: "TestSuiteId",
        },
      },
      TestScriptId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: "TestScript",
          key: "TestScriptId",
        },
      },
      TestScriptVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestScriptName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      FilePath: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      TestEnvironmentId: {
        type: DataTypes.STRING(50),
        allowNull: false,
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
      ResultDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      TestAgentName: {
        type: DataTypes.STRING(50),
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
      tableName: "TestScriptExecution",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_P_TestScriptExecutionId",
          unique: true,
          fields: [{ name: "TestScriptExecutionId" }],
        },
      ],
    }
  );
  TestScriptExecution.associate = (models) => {
    TestScriptExecution.belongsTo(models.OrchestrationExecution, {
      as: "OrchestrationExecution",
      foreignKey: "OrchestrationExecutionId",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
    });
  };

  return TestScriptExecution;
};
