const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationExecution",
    {},
    {
      sequelize,
      tableName: "TestExecutionResults",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      //deletedAt: "DeletedDate",
    }
  );
};
