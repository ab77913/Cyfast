module.exports = function (sequelize, DataTypes) {
  const TestScript = sequelize.define(
    "TestScript",
    {
      TestScriptId: {
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
      TestScriptName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      TestScriptDesc: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      FileName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      FilePath: {
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
      tableName: "TestScript",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      deletedAt: "DeletedDate",
      indexes: [
        {
          name: "PK_TC_TestScriptId",
          unique: true,
          fields: [{ name: "TestScriptId" }],
        },
      ],
    }
  );
  TestScript.associate = (models) => {
    TestScript.belongsTo(models.TestSuite, {
      as: "TestSuite",
      foreignKey: "TestSuiteId",
      onDelete: "CASCADE",
    });
    TestScript.hasMany(models.TestCase, {
      as: "TestCases",
      foreignKey: "TestScriptId",
    });
  };
  return TestScript;
};
