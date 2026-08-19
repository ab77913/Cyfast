"use strict";

const dotenv = require("dotenv");
const process = require("process");
const path = require("path");

dotenv.config();
const env = process.env.NODE_ENV || "local";
const dbTypePrimary = process.env.DATABASE_TYPE_PRIMARY || "mysql";
const dbTypeSecondary = process.env.DATABASE_TYPE_SECONDARY || null;
const mqType = process.env.MESSAGING_TYPE || "rabbitmq";

console.log("Environment-", env);
console.log("Primary Database-", dbTypePrimary);
console.log("Secondary Database-", dbTypeSecondary);
console.log("Messaging-", mqType);

const accessTokenSecret =
  process.env.ACCESS_TOKEN_SECRET ||
  "c480c35c293866bf36780a7109adf27ca38be2d38af5c765e58fa0dc9041e3862eef988352e0ac15aaba1b45f00b629a28ba17f9806e7236f62f332b7f83d282";
const refreshTokenSecret =
  process.env.REFRESH_TOKEN_SECRET ||
  "0c76d46b53bc1ee80fae2cebc9bd8388438490bd8fc7efb6317fb750ca1259a84ad04c71e9e8470bde8ecd4216b41b8e9915b453ee8ef380ace2175c4ea6790d";

const dbConfigPrimary = require(path.dirname(".") + "/configs/database.json")[
  dbTypePrimary
][env];
const dbConfigSecondary = dbTypeSecondary
  ? require(path.dirname(".") + "/configs/database.json")[dbTypeSecondary][env]
  : null;
const mqConfig = mqType
  ? require(path.dirname(".") + "/configs/messaging.json")[mqType][env]
  : null;

const appConfig = require(path.dirname(".") + "/configs/app.json")[env];

const MAX_GET_SIZE = process.env.MAX_GET_SIZE || "2MB";
const MAX_POST_SIZE = process.env.MAX_POST_SIZE || "8MB";

function sizeToBytes(size) {
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = sizes.findIndex((v) => size.includes(v));
  const sizeVal = size.replace(/[^\d.]/g, "");
  return parseInt(sizeVal, 10) * Math.pow(k, i < 0 ? 0 : i);
}

module.exports = {
  app_path: path.dirname("."),
  env: env,
  port: appConfig.port,
  host: appConfig.host,
  url: appConfig.protocol + "://" + appConfig.host + ":" + appConfig.port,
  accessTokenSecret: accessTokenSecret,
  refreshTokenSecret: refreshTokenSecret,
  db_type_primary: dbTypePrimary,
  database_primary: dbConfigPrimary,
  db_type_secondary: dbTypeSecondary,
  database_secondary: dbConfigSecondary,
  max_get_size: MAX_GET_SIZE,
  max_post_size: MAX_POST_SIZE,
  max_post_size_bytes: sizeToBytes(MAX_POST_SIZE),
  mq_type: mqType,
  mq_config: mqConfig,
};
