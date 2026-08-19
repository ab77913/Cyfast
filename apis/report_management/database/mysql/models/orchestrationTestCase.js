const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "OrchestrationTestCases",
    {},
    {
      sequelize,
      tableName: "OrchestrationTestCases", // Keep the table name as it is
      timestamps: true, // Keep timestamps for createdAt and updatedAt
      createdAt: "created_date", // Map to the appropriate column
      updatedAt: "ModifiedDate", // Map to the appropriate column
      //deletedAt: "DeletedDate", // Uncomment if soft deletes are needed
    }
  );
};
