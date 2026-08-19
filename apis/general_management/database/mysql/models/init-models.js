var DataTypes = require("sequelize").DataTypes;
var _Project = require("./project");
var _ProjectConfiguration = require("./project-configuration");
var _ProjectCustomConfiguration = require("./project-custom-configuration");

var _TestAgent = require("./test-agent");
var _ProjectTestAgent = require("./project-test-agent");

var _Orchestration = require("./orchestration");
var _OrchestrationConfiguration = require("./orchestration-configuration");
var _OrchestrationCustomConfiguration = require("./orchestration-custom-configuration");
var _OrchestrationTestCase = require("./orchestration-test-case");
var _OrchestrationExecution = require("./orchestration-execution");

var _Requirement = require("./requirement");
var _RequirementTestCase = require("./requirement-test-case");

var _Risk = require("./risk");
var _RiskRequirement = require("./risk-requirement");

var _TestSource = require("./test-source");
var _TestSuite = require("./test-suite");
var _TestScript = require("./test-script");
var _TestScriptExecution = require("./test-script-execution");

var _TestCase = require("./test-case");
var _TestCaseExecution = require("./test-case-execution");

var _TraceabilityImport = require("./traceability-import");

function initModels(sequelize) {
  // Initialize models
  var Project = _Project(sequelize, DataTypes);
  var ProjectConfiguration = _ProjectConfiguration(sequelize, DataTypes);
  var ProjectCustomConfiguration = _ProjectCustomConfiguration(
    sequelize,
    DataTypes
  );

  var TestAgent = _TestAgent(sequelize, DataTypes);
  var ProjectTestAgent = _ProjectTestAgent(sequelize, DataTypes);

  var Orchestration = _Orchestration(sequelize, DataTypes);
  var OrchestrationConfiguration = _OrchestrationConfiguration(
    sequelize,
    DataTypes
  );
  var OrchestrationCustomConfiguration = _OrchestrationCustomConfiguration(
    sequelize,
    DataTypes
  );
  var OrchestrationTestCase = _OrchestrationTestCase(sequelize, DataTypes);
  var OrchestrationExecution = _OrchestrationExecution(sequelize, DataTypes);

  var Requirement = _Requirement(sequelize, DataTypes);
  var RequirementTestCase = _RequirementTestCase(sequelize, DataTypes);
  var Risk = _Risk(sequelize, DataTypes);
  var RiskRequirement = _RiskRequirement(sequelize, DataTypes);

  var TestSource = _TestSource(sequelize, DataTypes);
  var TestSuite = _TestSuite(sequelize, DataTypes);
  var TestScript = _TestScript(sequelize, DataTypes);
  var TestScriptExecution = _TestScriptExecution(sequelize, DataTypes);
  var TestCase = _TestCase(sequelize, DataTypes);
  var TestCaseExecution = _TestCaseExecution(sequelize, DataTypes);
  var TraceabilityImport = _TraceabilityImport(sequelize, DataTypes);

  return {
    Project,
    ProjectConfiguration,
    ProjectCustomConfiguration,
    ProjectTestAgent,
    Orchestration,
    OrchestrationConfiguration,
    OrchestrationCustomConfiguration,
    OrchestrationTestCase,
    OrchestrationExecution,
    Requirement,
    RequirementTestCase,
    Risk,
    RiskRequirement,
    TestAgent,
    TestSource,
    TestSuite,
    TestScript,
    TestCase,
    TraceabilityImport,
    TestCaseExecution,
    TestScriptExecution,
  };
}

module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
