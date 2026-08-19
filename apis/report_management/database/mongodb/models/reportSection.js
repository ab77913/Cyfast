"use strict";

const mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    section_name: String,
    section_type: String,
    section_data: mongoose.Schema.Types.Mixed,
    order: Number,
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

const ReportSection = mongoose.model("report_sections", schema);

module.exports = ReportSection;
