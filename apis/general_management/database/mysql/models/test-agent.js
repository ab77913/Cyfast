const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  const TestAgent = sequelize.define(
    "TestAgent",
    {
      test_agent_id: {
        type: DataTypes.STRING(50),
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      host_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      host_ip: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      host_os: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      host_architecture: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      supported_execution_modes: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      supported_execution_bases: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "REGISTERED",
      },
      last_heartbeat: {
        type: DataTypes.DATE,
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
      tableName: "test_agent",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  TestAgent.associate = function (models) {
    // Define associations here if needed
    // For example, if TestAgent has many Projects assigned to it:
    TestAgent.hasMany(models.ProjectTestAgent, {
      foreignKey: "test_agent_id",
      as: "project_ids",
    });
  };

  return TestAgent;
};
