"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const config = require("../../../config.js");
const db = {};

// Customizing DATE field behavior in Sequelize for MySQL (if needed)
Sequelize.DATE.prototype._stringify = function _stringify(date, options) {
  date = this._applyTimezone(date, options);

  // MySQL does not support time zone in datetime/timestamp columns, so removing the 'Z'
  return date.format("YYYY-MM-DD HH:mm:ss.SSS");
};

let sequelize;
if (config.use_env_variable) {
  // Use the environment variable for the connection string (in case it's needed for cloud deployments)
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  try {
    // Connect to MySQL using Sequelize
    sequelize = new Sequelize(
      config.database_primary.database,  // Database name
      config.database_primary.username,  // Username
      config.database_primary.password,  // Password
      {
        ...config.database_primary,      // Spread the config properties for MySQL
        dialect: "mysql",                // Specify the MySQL dialect
        timezone: '+00:00',              // Ensure MySQL dates are stored in UTC
        logging: false,                  // Optionally, disable logging if not needed
      }
    );

    // Authenticate and handle any errors in connection
    sequelize
      .authenticate()
      .then(() => {
        console.log("Connection has been established successfully.");
      })
      .catch((err) => {
        console.error("Unable to connect to the database:", err);
      });
  } catch (dbError) {
    console.error(dbError);
  }
}

// Dynamically read all model files from the current directory
fs.readdirSync(__dirname)
  .filter((file) => {
    // Exclude hidden files, the current file, and test files
    return file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js" && file.indexOf(".test.js") === -1;
  })
  .forEach((file) => {
    // Load each model and associate it with the Sequelize instance
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Apply associations between models if they exist
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Export the Sequelize instance and models
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
