var DataTypes = require("sequelize").DataTypes;
var _Organization = require("./organization.js");
var _User = require("./user.js");
var _Role = require("./role.js");
var _Permission = require("./permission.js");
var _RolePermission = require("./rolePermission.js");

function initModels(sequelize) {
  var Organization = _User(sequelize, DataTypes);
  var User = _User(sequelize, DataTypes);
  var Role = _Role(sequelize, DataTypes);
  var Permission = _Permission(sequelize, DataTypes);
  var RolePermission = _RolePermission(sequelize, DataTypes);

  //Organization.hasMany(Project, { as: "Projects", foreignKey: "OrganizationId" });
  //Project.belongsTo(Organization, { as: "Organization", foreignKey: "OrganizationId" });

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
