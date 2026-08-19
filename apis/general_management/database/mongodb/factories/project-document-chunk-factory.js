"use strict";

const db = require("../models");
const ProjectDocumentChunk = db.projectDocumentChunk;

const bulkInsertTree = async (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  try {
    return await ProjectDocumentChunk.insertMany(nodes, { ordered: false });
  } catch (error) {
    console.log("bulkInsertTree error:", error.message);
    return [];
  }
};

const replaceForDocument = async (projectDocumentId, nodes) => {
  await ProjectDocumentChunk.deleteMany({
    project_document_id: projectDocumentId,
  });
  return bulkInsertTree(nodes);
};

const removeByDocument = async (projectDocumentId) => {
  try {
    return await ProjectDocumentChunk.deleteMany({
      project_document_id: projectDocumentId,
    });
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getTree = async (projectDocumentId) => {
  try {
    return await ProjectDocumentChunk.find({
      project_document_id: projectDocumentId,
    })
      .sort({ depth: 1, order_index: 1 })
      .lean();
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getRoot = async (projectDocumentId) => {
  try {
    return await ProjectDocumentChunk.findOne({
      project_document_id: projectDocumentId,
      node_type: "DOCUMENT",
    }).lean();
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getChildren = async (projectDocumentId, parentNodeId) => {
  try {
    return await ProjectDocumentChunk.find({
      project_document_id: projectDocumentId,
      parent_node_id: parentNodeId,
    })
      .sort({ order_index: 1 })
      .lean();
  } catch (error) {
    console.log(error);
    return [];
  }
};

const getNode = async (projectDocumentId, nodeId) => {
  try {
    return await ProjectDocumentChunk.findOne({
      project_document_id: projectDocumentId,
      node_id: nodeId,
    }).lean();
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getChunksByIds = async (projectDocumentId, nodeIds) => {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
  try {
    return await ProjectDocumentChunk.find({
      project_document_id: projectDocumentId,
      node_id: { $in: nodeIds },
    }).lean();
  } catch (error) {
    console.log(error);
    return [];
  }
};

/**
 * Run a $text search across all parsed chunks for a project, optionally narrowed by doc types
 * and/or document ids. Returns ordered results by Mongo text score. Used as a fallback /
 * lexical signal alongside the PageIndex tree walk.
 */
const textSearch = async ({
  projectId,
  organizationId = null,
  docTypes = null,
  projectDocumentIds = null,
  query,
  limit = 20,
}) => {
  if (!query || typeof query !== "string") return [];
  try {
    const conditions = {
      project_id: Number(projectId),
      node_type: "CHUNK",
      $text: { $search: query },
    };
    if (organizationId) conditions.organization_id = Number(organizationId);
    if (Array.isArray(docTypes) && docTypes.length > 0) {
      conditions.doc_type = { $in: docTypes };
    }
    if (Array.isArray(projectDocumentIds) && projectDocumentIds.length > 0) {
      conditions.project_document_id = { $in: projectDocumentIds.map(Number) };
    }

    return await ProjectDocumentChunk.find(conditions, {
      score: { $meta: "textScore" },
    })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();
  } catch (error) {
    console.log("textSearch error:", error.message);
    return [];
  }
};

const countByDocument = async (projectDocumentId) => {
  try {
    return await ProjectDocumentChunk.countDocuments({
      project_document_id: projectDocumentId,
      node_type: "CHUNK",
    });
  } catch (error) {
    console.log(error);
    return 0;
  }
};

module.exports = {
  bulkInsertTree,
  replaceForDocument,
  removeByDocument,
  getTree,
  getRoot,
  getChildren,
  getNode,
  getChunksByIds,
  textSearch,
  countByDocument,
};
