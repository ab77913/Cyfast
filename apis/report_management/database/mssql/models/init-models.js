var DataTypes = require("sequelize").DataTypes;
var _OrchestrationTestCase = require("./orchestrationTestCase.js");
var _OrchestrationExecution = require("./orchestrationExecution.js");
var _TestExecution = require("./testExecution.js");

function initModels(sequelize) {
  var OrchestrationTestCase = _OrchestrationTestCase(sequelize, DataTypes);
  var OrchestrationExecution = _OrchestrationExecution(sequelize, DataTypes);
  var TestExecution = _TestExecution(sequelize, DataTypes);

  //Organization.hasMany(Project, { as: "Projects", foreignKey: "OrganizationId" });
  //Project.belongsTo(Organization, { as: "Organization", foreignKey: "OrganizationId" });

  return {
    OrchestrationTestCase,
    OrchestrationExecution,
    TestExecution,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
