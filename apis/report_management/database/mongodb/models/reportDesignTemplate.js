"use strict";

const mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    filepath: String,
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    created_by: String,
    modified_by: String,
  },
  {
    timestamps: {
      createdAt: "created_date",
      updatedAt: "modified_date",
    },
  }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const ReportDesignTemplate = mongoose.model("report_design_templates", schema);

module.exports = ReportDesignTemplate;
