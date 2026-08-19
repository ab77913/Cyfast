const { MAX } = require("mssql");
const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationConfiguration",
    {
      OrchestrationConfigurationId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
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

      Options: {
        type: DataTypes.STRING(MAX),
        allowNull: true,
      },
      Phase: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      SiteAddress: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      AppPath: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      AppVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      AppDeploymentPath: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      AppExecutionPath: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      DriverHost: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      DriverPort: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      ChannelType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      DriverProtocol: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      CreatedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      CreatedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      ModifiedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      ModifiedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      DeletedBy: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      DeletedDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },

    {
      sequelize,
      tableName: "OrchestrationConfiguration",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_PTE_OrchestrationConfigurationId",
          unique: true,
          fields: [{ name: "OrchestrationConfigurationId" }],
        },
      ],
    }
  );
};
