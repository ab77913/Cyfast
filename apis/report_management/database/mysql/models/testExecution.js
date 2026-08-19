const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "TestExecution",
    {},
    {
      sequelize,
      tableName: "TestExecutionResultDetails",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "ModifiedDate",
      // deletedAt: "DeletedDate",
    }
  );
};
