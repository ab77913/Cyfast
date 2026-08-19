const Sequelize = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "TestExecution",
    {},
    {
      sequelize,
      tableName: "TestExecutionResultDetails",
      schema: "dbo",
      timestamps: true,
      createdAt: "CreatedDate",
      updatedAt: "ModifiedDate",
      //deletedAt: "DeletedDate",
    }
  );
};
