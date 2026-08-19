const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "ProjectConfiguration",
    {
      ProjectConfigurationId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
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

      TestCaseMode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestCaseSource: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestCaseSourcePath: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      TestCaseSourceCloudUrl: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      TestCaseRepositoryServerUrl: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      TestCaseRepositoryBranchName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      TestCaseSourceSuiteName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      TestCaseRepositoryUsername: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      TestCaseRepositoryPassword: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      TestCaseRepositoryAccessToken: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      TestCaseRepositoryType: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestFramework: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      EnableLogging: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      EmailsToNotify: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Phase: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      ApplicationName: {
        type: DataTypes.STRING(20),
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
      tableName: "ProjectConfiguration",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_PTE_ProjectConfigurationId",
          unique: true,
          fields: [{ name: "ProjectConfigurationId" }],
        },
      ],
    }
  );
};
