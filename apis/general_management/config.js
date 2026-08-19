"use strict";

const dotenv = require("dotenv");
const assert = require("assert");
const process = require("process");
const path = require("path");

// Load environment variables from a .env file if present
dotenv.config();

// Set default environment to 'local' if NODE_ENV is not defined
const env = process.env.NODE_ENV || "local";

// Set default primary database to 'mysql' if not defined
const dbTypePrimary = process.env.DATABASE_TYPE_PRIMARY || "mysql";
// Set secondary database to null if not defined
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || null;
// Set messaging type to null if not defined
const mqType = process.env.MESSAGING_TYPE || null;

// Log the current environment, database types, and messaging configuration
console.log("Environment-", env);
console.log("Primary Database-", dbTypePrimary);
console.log("Secondary Database-", dbTypeSecondary);
console.log("Messaging-", mqType);

// Load the primary database configuration from a JSON file
const dbConfigPrimary = require(__dirname + "/configs/database.json")[
  dbTypePrimary
][env];

// Load the secondary database configuration if defined
const dbConfigSecondary = dbTypeSecondary
  ? require(__dirname + "/configs/database.json")[dbTypeSecondary][env]
  : null;

// Load messaging configuration if defined
const mqConfig = mqType
  ? require(__dirname + "/configs/messaging.json")[mqType][env]
  : null;

// Load the messaging queues and exchanges
const mqQueues = require(__dirname + "/configs/messaging.json").queues;
const mqExchanges = require(__dirname + "/configs/messaging.json").exchanges;

// Load the application configuration
const appConfig = require(__dirname + "/configs/app.json")[env];

// Set maximum GET and POST sizes, with defaults if not defined in environment variables
const MAX_GET_SIZE = process.env.MAX_GET_SIZE || "2MB";
const MAX_POST_SIZE = process.env.MAX_POST_SIZE || "8MB";

function sizeToBytes(size) {
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = sizes.findIndex((v) => size.includes(v));
  const sizeVal = size.replace(/[^\d.]/g, "");
  return parseInt(sizeVal, 10) * Math.pow(k, i < 0 ? 0 : i);
}

const MAX_POST_SIZE_BYTES = sizeToBytes(MAX_POST_SIZE);

const DEFAULT_TEMPLATES = {
  CONSOLE_LOG: {
    name: "Default Console Log",
    filename: "default-console-log.html",
    dirpath: __dirname + path.sep + "storage",
  },
  ORCHESTRATION_EXECUTION_LOG: {
    name: "Default Orchestration Execution Log",
    filename: "default-orchestration-execution-log.html",
    dirpath: __dirname + path.sep + "storage",
  },
  ORCHESTRATION_TEST_SUMMARY: {
    name: "Default Orchestration Test Summary",
    filename: "default-orchestration-test-summary.html",
    dirpath: __dirname + path.sep + "storage",
  },
  TEST_SUMMARY: {
    name: "Default Test Summary",
    filename: "default-test-summary.html",
    dirpath: __dirname + path.sep + "storage",
  },
};

// Export the configuration as a module
module.exports = {
  app_path: __dirname, // Base path of the app
  env: env, // Environment (e.g., local, production)
  port: appConfig.port, // App port from app.json
  host: appConfig.host, // App host from app.json
  url: `${appConfig.protocol}://${appConfig.host}:${appConfig.port}`, // Full app URL
  db_type_primary: dbTypePrimary, // Primary database type (e.g., mysql)
  database_primary: dbConfigPrimary, // Primary database config (loaded from database.json)
  db_type_secondary: dbTypeSecondary, // Secondary database type (e.g., mssql), if defined
  database_secondary: dbConfigSecondary, // Secondary database config, if defined
  max_get_size: MAX_GET_SIZE, // Maximum GET request size
  max_post_size: MAX_POST_SIZE, // Maximum POST request size
  max_post_size_bytes: MAX_POST_SIZE_BYTES,
  mq_type: mqType, // Messaging type (e.g., RabbitMQ), if defined
  mq_config: mqConfig, // Messaging config, if defined
  mq_queues: mqQueues, // Messaging queues
  mq_exchanges: mqExchanges, // Messaging exchanges
  default_templates: DEFAULT_TEMPLATES, // Default templates for reports
  // Python AI Engine — vectorless RAG (POST /v1/rag/search). If unset, GM uses embedded rag-service.js.
  ai_engine_url: (process.env.AI_ENGINE_URL || "").replace(/\/+$/, ""),
};
