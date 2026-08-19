"use strict";

const mongoose = require("mongoose");

var schema = mongoose.Schema(
  {
    template_name: String,
    report_type: String,
    sections: [String],
    is_default: { type: Boolean, default: false },
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

const ReportTemplate = mongoose.model("report_templates", schema);

module.exports = ReportTemplate;
