"use strict";

const config = require("../../../config");
const dbConfig = config.database_secondary;

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = "mongodb://" + dbConfig.username + ":" + dbConfig.password + "@" + dbConfig.host + ":27017/" + dbConfig.database + "?authSource=admin";

db.reportDesignTemplate = require("./reportDesignTemplate.js");
db.reportTemplate = require("./reportTemplate.js");
db.reportSection = require("./reportSection.js");
db.projectDocumentChunk = require("./projectDocumentChunk.js");

console.log("Connecting to MongoDB...");
db.mongoose
  .connect(db.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB successfully!");
  })
  .catch((err) => {
    console.log("Cannot connect to MongoDB!", err);
    process.exit();
  });

module.exports = db;
