"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const config = require("../../../config.js");
const db = {};

Sequelize.DATE.prototype._stringify = function _stringify(date, options) {
  date = this._applyTimezone(date, options);
  return date.format("YYYY-MM-DD HH:mm:ss.SSS");
};

let sequelize;
if (config.use_env_variable) {
  // Use environment variable for database connection if configured
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  try {
    // Instantiate Sequelize using credentials from the config
    sequelize = new Sequelize(
      config.database_primary.database,
      config.database_primary.username,
      config.database_primary.password,
      config.database_primary
    );

    // Test the connection to the MySQL database
    sequelize
      .authenticate()
      .then(() => {
        console.log("MySQL database connection established successfully.");
      })
      .catch((err) => {
        console.error("Unable to connect to the MySQL database:", err);
      });
  } catch (dbError) {
    console.error("Database initialization error:", dbError);
  }
}

// Dynamically read and import all models from the current directory
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== "index.js" &&
      file !== "init-models.js" &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    if (model && model.models) {
      Object.assign(db, model.models);
    } else if (model && model.name) {
      db[model.name] = model;
    } else {
      console.warn("Invalid model export:", file); // Optional: log the problematic file
    }
  });

// Call associate method for each model if it exists (to set up relationships)
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Expose sequelize and Sequelize objects on the db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
