"use strict";

/**
 * PageIndex-style tree node for a parsed project document.
 *
 * One MongoDB document per node in the document's hierarchical tree (heading -> sub-heading -> chunk).
 * The root node represents the whole document (`node_type: "DOCUMENT"`); intermediate nodes
 * (`node_type: "SECTION"`) carry summaries; leaf nodes (`node_type: "CHUNK"`) carry verbatim text.
 *
 * At RAG-query time the LLM/router walks this tree top-down using the `summary` and `heading`
 * fields, then materializes the relevant `CHUNK` nodes for synthesis — no vector embeddings
 * are required for retrieval (vectorless RAG).
 */

const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    project_document_id: { type: Number, required: true, index: true },
    project_id: { type: Number, required: true, index: true },
    organization_id: { type: Number, required: true, index: true },
    doc_type: { type: String, required: true, index: true },

    node_id: { type: String, required: true },               // stable, document-scoped id (e.g. "0", "0.1", "0.1.2")
    parent_node_id: { type: String, default: null, index: true },
    children_node_ids: { type: [String], default: [] },

    depth: { type: Number, default: 0 },                     // 0 = document root
    node_type: {
      type: String,
      enum: ["DOCUMENT", "SECTION", "CHUNK"],
      required: true,
      index: true,
    },

    section_path: { type: String, default: "" },             // "1.2.3 Functional Requirements > Authentication"
    heading: { type: String, default: "" },
    page_number: { type: Number, default: null },            // for PDF / paginated formats
    order_index: { type: Number, default: 0 },               // sibling ordering

    content: { type: String, default: "" },                  // verbatim chunk text (CHUNK only)
    summary: { type: String, default: "" },                  // short LLM/heuristic summary (used by tree router)
    token_count: { type: Number, default: 0 },
    char_count: { type: Number, default: 0 },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: {
      createdAt: "created_date",
      updatedAt: "modified_date",
    },
  }
);

schema.index({ project_document_id: 1, node_id: 1 }, { unique: true });
schema.index({ project_id: 1, doc_type: 1, node_type: 1 });
schema.index(
  { heading: "text", summary: "text", content: "text" },
  { name: "project_document_chunk_text_idx" }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

module.exports = mongoose.model("project_document_chunk", schema);
