var DataTypes = require("sequelize").DataTypes;
var _Organization = require("./organization.js");
var _User = require("./user.js");
var _Role = require("./role.js");
var _Permission = require("./permission.js");
var _RolePermission = require("./role-permission.js");

function initModels(sequelize) {
  var Organization = _Organization(sequelize, DataTypes); // Correctly assign Organization
  var User = _User(sequelize, DataTypes);
  var Role = _Role(sequelize, DataTypes);
  var Permission = _Permission(sequelize, DataTypes);
  var RolePermission = _RolePermission(sequelize, DataTypes);

  // Uncomment if you need associations
  // Organization.hasMany(Project, { as: "Projects", foreignKey: "organization_id" });
  // Project.belongsTo(Organization, { as: "Organization", foreignKey: "organization_id" });

  return {
    Organization,
    User,
    Role,
    Permission,
    RolePermission,
  };
}

module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
