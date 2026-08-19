"use strict";

const config = require("../../../config");
const mongoose = require("mongoose");

mongoose.Promise = global.Promise;

const db = {};
db.mongoose = mongoose;
db.url = config.mongo_url;

// Load models
db.FileMetadata = require("./fileMetadata");

// Connect to MongoDB
console.log("Connecting to MongoDB...");
db.mongoose
  .connect(db.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("✓ Connected to MongoDB successfully!");
  })
  .catch((err) => {
    console.error("✗ Cannot connect to MongoDB!", err.message);
    process.exit(1);
  });

module.exports = db;
