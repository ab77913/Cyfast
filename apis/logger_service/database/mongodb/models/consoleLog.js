"use strict";

const mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    test_execution_id: Number,
    orchestration_execution_id: String,
    agent: Object,
    environment: Object,
    project_id: Number,
    orchestration_id: Number,
    logs: Array,
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

const ConsoleLog = mongoose.model("console_logs", schema);

module.exports = ConsoleLog;
