module.exports = function (sequelize, DataTypes) {
  const TestCase = sequelize.define(
    "TestCase",
    {
      TestCaseId: {
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
      TestSuiteId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      TestScriptId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      TestCaseNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      TestCaseVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      TestCaseName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      TestCaseDesc: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Tags: {
        type: DataTypes.STRING(255),
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
      tableName: "TestCase",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_TC_TestCaseId",
          unique: true,
          fields: [{ name: "TestCaseId" }],
        },
      ],
    }
  );
  TestCase.associate = (models) => {
    TestCase.belongsTo(models.TestSuite, {
      as: "TestSuite",
      foreignKey: "TestSuiteId",
      onDelete: "CASCADE",
    });
    TestCase.belongsTo(models.TestScript, {
      as: "TestScript",
      foreignKey: "TestScriptId",
      onDelete: "CASCADE",
    });
  };
  return TestCase;
};
