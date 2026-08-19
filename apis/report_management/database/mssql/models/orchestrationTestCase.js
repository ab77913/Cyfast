const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationTestCases",
    {},
    {
      sequelize,
      tableName: "OrchestrationTestCases",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      //deletedAt: "DeletedDate",
    }
  );
};
