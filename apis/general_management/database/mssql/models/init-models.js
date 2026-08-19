var DataTypes = require("sequelize").DataTypes;
var _Organization = require("./organization");
var _Project = require("./project");
var _ProjectConfiguration = require("./projectConfiguration");
var _ProjectTestEnvironment = require("./projectTestEnvironment");
var _Repository = require("./repository");
var _Orchestration = require("./orchestration");
var _OrchestrationConfiguration = require("./orchestrationConfiguration");
var _OrchestrationTestCase = require("./orchestrationTestCase");
var _OrchestrationExecution = require("./orchestrationExecution");
var _TestCaseExecution = require("./testCaseExecution");
var _Requirement = require("./requirement");
var _RequirementTestCase = require("./requirementTestCase");
var _Risk = require("./risk");
var _RiskRequirement = require("./riskRequirement");
var _TestSuite = require("./testSuite");
var _TestScript = require("./testScript");
var _TestCase = require("./testCase");
var _TraceabilityImport = require("./traceabilityImport");

function initModels(sequelize) {
  var Organization = _Organization(sequelize, DataTypes);
  var Project = _Project(sequelize, DataTypes);
  var ProjectConfiguration = _ProjectConfiguration(sequelize, DataTypes);
  var ProjectTestEnvironment = _ProjectTestEnvironment(sequelize, DataTypes);
  var Repository = _Repository(sequelize, DataTypes);
  var Orchestration = _Orchestration(sequelize, DataTypes);
  var OrchestrationConfiguration = _OrchestrationConfiguration(sequelize, DataTypes);
  var OrchestrationTestCase = _OrchestrationTestCase(sequelize, DataTypes);
  var OrchestrationExecution = _OrchestrationExecution(sequelize, DataTypes);
  var TestCaseExecution = _TestCaseExecution(sequelize, DataTypes);
  var Requirement = _Requirement(sequelize, DataTypes);
  var RequirementTestCase = _RequirementTestCase(sequelize, DataTypes);
  var Risk = _Risk(sequelize, DataTypes);
  var RiskRequirement = _RiskRequirement(sequelize, DataTypes);
  var TestSuite = _TestSuite(sequelize, DataTypes);
  var TestScript = _TestScript(sequelize, DataTypes);
  var TestCase = _TestCase(sequelize, DataTypes);
  var TraceabilityImport = _TraceabilityImport(sequelize, DataTypes);

  Project.belongsTo(Organization, { as: "Organization", foreignKey: "OrganizationId" });
  Organization.hasMany(Project, { as: "Projects", foreignKey: "OrganizationId" });
  Repository.belongsTo(Organization, { as: "Organization", foreignKey: "OrganizationId" });
  Organization.hasMany(Repository, { as: "Repositories", foreignKey: "OrganizationId" });
  Project.hasMany(Repository, { as: "Repositories", foreignKey: "ProjectId" });
  ProjectTestEnvironment.belongsTo(Project, { as: "Project", foreignKey: "ProjectId" });
  Project.hasMany(ProjectTestEnvironment, { as: "ProjectTestEnvironments", foreignKey: "ProjectId" });

  return {
    Organization,
    Project,
    ProjectConfiguration,
    ProjectTestEnvironment,
    Repository,
    Orchestration,
    OrchestrationConfiguration,
    Requirement,
    RequirementTestCase,
    Risk,
    RiskRequirement,
    TestSuite,
    TestScript,
    TestCase,
    TraceabilityImport,
    OrchestrationTestCase,
    OrchestrationExecution,
    TestCaseExecution,
  };
}

module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
