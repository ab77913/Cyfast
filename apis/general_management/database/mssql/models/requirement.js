module.exports = function (sequelize, DataTypes) {
  const Requirement = sequelize.define(
    "Requirement",
    {
      RequirementId: {
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
      RequirementNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      RequirementVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      RequirementTitle: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      RequirementDesc: {
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
      tableName: "Requirement",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_REQ_RequirementId",
          unique: true,
          fields: [{ name: "RequirementId" }],
        },
      ],
    }
  );
  Requirement.associate = function (models) {
    Requirement.hasMany(models.RequirementTestCase, {
      foreignKey: "RequirementId",
      as: "requirementTestCases",
    });
  };
  return Requirement;
};
