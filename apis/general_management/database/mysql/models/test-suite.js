const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestSuite = sequelize.define(
    "TestSuite",
    {
      test_suite_id: {
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
        allowNull: true,
        references: {
          model: "Project", // Ensure this model is defined
          key: "project_id",
        },
      },
      test_source_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "TestSource", // Ensure this model is defined
          key: "test_source_id",
        },
      },

      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      test_framework: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      directory_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      directory_path: {
        type: DataTypes.STRING(250),
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
      tableName: "test_suite",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );
  // Define associations
  TestSuite.associate = (models) => {
    TestSuite.belongsTo(models.Project, {
      foreignKey: "project_id",
      as: "project",
    });
    TestSuite.belongsTo(models.TestSource, {
      foreignKey: "test_source_id",
      as: "test_source",
    });
    TestSuite.hasMany(models.TestCase, {
      foreignKey: "test_suite_id",
      as: "test_cases",
    });
    TestSuite.hasMany(models.TestScript, {
      foreignKey: "test_suite_id",
      as: "test_scripts",
    });
  };

  return TestSuite;
};
