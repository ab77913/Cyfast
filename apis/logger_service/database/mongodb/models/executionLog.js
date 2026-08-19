"use strict";

var mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    project_id: Number,
    orchestration_id: Number,
    orchestration_execution_id: String,
    agent: Object,
    file_name: String,
    mime_type: String,
    file_extension: String,
    format: String,
    source_file_path: String,
    log_content: String,
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

const ExecutionLog = mongoose.model("execution_logs", schema);

module.exports = ExecutionLog;
