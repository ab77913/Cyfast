"use strict";

const mongoose = require("mongoose");

const fileMetadataSchema = mongoose.Schema(
  {
    file_id: {
      type: String,
      required: true,
      unique: true
    },
    partition_key: {
      type: String,
      required: true,
      index: true
    },
    folder_path: {
      type: String,
      default: ""
    },
    original_filename: {
      type: String,
      required: true
    },
    stored_filename: {
      type: String,
      required: true
    },
    file_path: {
      type: String,
      required: true
    },
    file_url: {
      type: String,
      required: true
    },
    mime_type: {
      type: String,
      required: true
    },
    file_size: {
      type: Number,
      required: true
    },
    encoding: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    is_deleted: {
      type: Boolean,
      default: false
    },
    deleted_at: {
      type: Date,
      default: null
    },
    uploaded_by: {
      type: String,
      default: "system"
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

// Indexes for better query performance
fileMetadataSchema.index({ partition_key: 1, folder_path: 1 });
fileMetadataSchema.index({ is_deleted: 1 });
fileMetadataSchema.index({ created_at: -1 });

// Custom toJSON to format response
fileMetadataSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const FileMetadata = mongoose.model("file_metadata", fileMetadataSchema);

module.exports = FileMetadata;
