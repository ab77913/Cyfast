"use strict";

const dotenv = require("dotenv");
const assert = require("assert");
const process = require("process");

dotenv.config();
const env = process.env.NODE_ENV || "local";
const dbTypePrimary = process.env.DATABASE_TYPE_PRIMARY || null;
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || "elasticsearch";
const mqType = process.env.MESSAGING_TYPE || "rabbitmq";
console.log("Environment-", env);
console.log("Database-", dbTypeSecondary);
console.log("Messaging-", mqType);

const dbConfig = require("./config/database.json")[dbTypeSecondary][env];
const dbConfigPrimary = dbTypePrimary ? require(__dirname + "/config/database.json")[dbTypePrimary][env] : null;
const dbConfigSecondary = dbTypeSecondary ? require(__dirname + "/config/database.json")[dbTypeSecondary][env] : null;
const mqConfig = require("./config/messaging.json")[mqType][env];
const appConfig = require("./config/app.json")[env];
const storageConfig = require("./config/storage.json")[env];

const storageDirPath = process.env.STORAGE_DIR_PATH || storageConfig.dir_path;

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
  storage_dir_path: storageDirPath,
};
