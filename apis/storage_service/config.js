"use strict";

const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

// Set default environment
const env = process.env.NODE_ENV || "local";

console.log("Environment:", env);

// Load configurations
const appConfig = require(__dirname + "/configs/app.json")[env];
const dbConfig = require(__dirname + "/configs/database.json")["mongodb"][env];

// MongoDB URL
const mongoUrl = `mongodb://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}?authSource=admin`;

// Export configuration
module.exports = {
  env: env,
  port: process.env.PORT || appConfig.port,
  host: process.env.HOST || appConfig.host,
  protocol: appConfig.protocol,
  url: `${appConfig.protocol}://${process.env.HOST || appConfig.host}:${process.env.PORT || appConfig.port}`,
  storage_path: appConfig.storage_path,
  max_file_size: appConfig.max_file_size,
  allowed_mime_types: appConfig.allowed_mime_types,
  database: dbConfig,
  mongo_url: mongoUrl,
  log_level: process.env.LOG_LEVEL || "info"
};
