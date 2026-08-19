var DataTypes = require("sequelize").DataTypes;
var _OrchestrationTestCase = require("./orchestrationTestCase.js");
var _OrchestrationExecution = require("./orchestrationExecution.js");
var _TestExecution = require("./testExecution.js");

function initModels(sequelize) {
  var OrchestrationTestCase = _OrchestrationTestCase(sequelize, DataTypes);
  var OrchestrationExecution = _OrchestrationExecution(sequelize, DataTypes);
  var TestExecution = _TestExecution(sequelize, DataTypes);

  // Assuming MySQL here:
  // Sequelize handles foreign key constraints in both MSSQL and MySQL, so no change is needed here.
  // Ensure your MySQL tables are configured to support foreign keys (e.g., using InnoDB engine).

  // Define associations if needed. These commented associations should work the same for MySQL:
  // OrchestrationTestCase.hasMany(OrchestrationExecution, { as: "Executions", foreignKey: "orchestration_test_case_id" });
  // OrchestrationExecution.belongsTo(OrchestrationTestCase, { as: "TestCase", foreignKey: "orchestration_test_case_id" });

  // OrchestrationExecution.hasMany(TestExecution, { as: "TestExecutions", foreignKey: "orchestration_execution_id" });
  // TestExecution.belongsTo(OrchestrationExecution, { as: "Execution", foreignKey: "orchestration_execution_id" });

  return {
    OrchestrationTestCase,
    OrchestrationExecution,
    TestExecution,
  };
}

module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
