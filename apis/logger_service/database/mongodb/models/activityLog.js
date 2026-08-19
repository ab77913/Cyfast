"use strict";

const mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    source: String,
    group: String,
    type: String,
    server: Object,
    message: String,
    details: String,
    username: String,
  },
  {
    timestamps: {
      createdAt: "created_date", // Use `created_date` to store the created date
      updatedAt: "modified_date", // and `modified_date` to store the last updated date
    },
  }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const ActivityLog = mongoose.model("activity_logs", schema);

module.exports = ActivityLog;
