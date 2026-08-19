"use strict";

const config = require("../../../config");
const dbConfig = config.database_secondary;

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = "mongodb://" + dbConfig.username + ":" + dbConfig.password + "@" + dbConfig.host + ":27017/" + dbConfig.database + "?authSource=admin";

db.applicationLog = require("./applicationLog.js");
db.activityLog = require("./activityLog.js");
db.auditLog = require("./auditLog.js");
db.consoleLog = require("./consoleLog.js");
db.executionLog = require("./executionLog.js");

module.exports = db;
