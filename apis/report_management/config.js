"use strict";

const dotenv = require("dotenv");
const assert = require("assert");
const process = require("process");

dotenv.config();
const env = process.env.NODE_ENV || "local";
const dbTypePrimary = process.env.DATABASE_TYPE_PRIMARY || "mssql";
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || "elasticsearch";
const mqType = process.env.MESSAGING_TYPE || "rabbitmq";
console.log("Environment-", env);
console.log("Primary Database-", dbTypePrimary);
console.log("Secondary Database-", dbTypeSecondary);
console.log("Messaging-", mqType);

const dbConfigPrimary = require(__dirname + "/config/database.json")[dbTypePrimary][env];
const dbConfigSecondary = dbTypeSecondary ? require(__dirname + "/config/database.json")[dbTypeSecondary][env] : null;
const mqConfig = mqType ? require(__dirname + "/config/messaging.json")[mqType][env] : null;
const appConfig = require(__dirname + "/config/app.json")[env];

//const { PORT, HOST, PROTOCOL } = process.env;
//const HOST_URL = `${PROTOCOL}://${HOST}:${PORT}`;
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
    fileName: "defaultConsoleLog.html",
    dirPath: __dirname + "/storage",
  },
  ORCHESTRATION_EXECUTION_LOG: {
    name: "Default Orchestration Execution Log",
    fileName: "defaultOrchestrationExecutionLog.html",
    dirPath: __dirname + "/storage",
  },
  ORCHESTRATION_TEST_SUMMARY: {
    name: "Default Orchestration Test Summary",
    fileName: "defaultOrchestrationTestSummary.html",
    dirPath: __dirname + "/storage",
  },
  TEST_SUMMARY: {
    name: "Default Test Summary",
    fileName: "defaultTestSummary.html",
    dirPath: __dirname + "/storage",
  },
};

module.exports = {
  app_path: __dirname,
  env: env,
  port: appConfig.port,
  host: appConfig.host,
  url: appConfig.protocol + "://" + appConfig.host + ":" + appConfig.port,
  db_type_primary: dbTypePrimary,
  database_primary: dbConfigPrimary,
  db_type_secondary: dbTypeSecondary,
  database_secondary: dbConfigSecondary,
  max_get_size: MAX_GET_SIZE,
  max_post_size: MAX_POST_SIZE,
  max_post_size_bytes: MAX_POST_SIZE_BYTES,
  mq_type: mqType,
  mq_config: mqConfig,
  loggerServiceUrl: appConfig.logger_api_url,
  default_templates: DEFAULT_TEMPLATES,
};
