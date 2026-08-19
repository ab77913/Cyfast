module.exports = function (sequelize, DataTypes) {
  const Risk = sequelize.define(
    "Risk",
    {
      RiskId: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      OrganizationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ProjectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      RiskNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: "VersionedRisk",
      },
      RiskVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: "VersionedRisk",
      },
      RiskTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      RiskDesc: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      RpnNumber: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      Severity: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      Occurence: {
        type: DataTypes.SMALLINT,
        allowNull: true,
      },
      Detection: {
        type: DataTypes.SMALLINT,
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
      tableName: "Risk",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_RSK_RiskId",
          unique: true,
          fields: [{ name: "RiskId" }],
        },
      ],
    }
  );
  Risk.associate = function (models) {
    Risk.hasMany(models.RiskRequirement, {
      foreignKey: "RiskId",
      as: "riskRequirements",
    });
  };
  return Risk;
};
