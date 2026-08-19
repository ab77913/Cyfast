"use strict";

/**
 * Project Document controller — Gen AI V&V document ingestion entry point.
 *
 * Endpoints handled here (mounted at /project_documents by routes/project-document-routes.js):
 *
 *   GET    /project_documents                       List + filter
 *   GET    /project_documents/doc_types             Allowed document type catalog
 *   GET    /project_documents/:id                   Fetch one
 *   GET    /project_documents/:id/download          Redirect to storage_service URL
 *   DELETE /project_documents/:id                   Soft / hard delete
 *   POST   /project_documents/:id/reparse           Re-run parsing + indexing
 *   POST   /project_documents/search                Vectorless RAG search (PageIndex traversal)
 *   POST   /project_documents/chat                  Same retrieval + answer (LLM via ai_engine when configured)
 *
 *   POST   /project_documents/upload                Multipart upload (consumed in routes via Fastify
 *                                                   parts iterator; this controller exposes the
 *                                                   plain handler `uploadProjectDocument` that the
 *                                                   route wires after parsing the multipart body).
 */

const helpers = require("../helpers");
const projectDocumentFactory = require("../database/mysql/factories/project-document-factory");
const projectDocumentService = require("../services/project-document-service");
const ragService = require("../services/rag-service");
const aiEngineClient = require("../services/ai-engine-client");

const DOC_TYPE_CATALOG = [
  { value: "BRD", label: "Business Requirement Document" },
  { value: "SRS", label: "Software Requirement Specification" },
  { value: "FRS", label: "Functional Specification" },
  { value: "REGULATORY", label: "Regulatory" },
  { value: "SAFETY_REQUIREMENTS", label: "Safety Requirements" },
  { value: "EXPORTED_REQUIREMENTS", label: "Exported Requirements" },
  { value: "EXPORTED_TEST_CASES", label: "Exported Test Cases" },
  { value: "DESIGN", label: "Design / Architecture" },
  { value: "OTHER", label: "Other" },
];

const getDocTypes = async (req, res) => {
  try {
    return res.status(200).json({ data: DOC_TYPE_CATALOG });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getProjectDocuments = async (req, res) => {
  try {
    const { filters, sort, include, page, size } =
      helpers.parseListFetchQuery(req.query);
    const data = await projectDocumentFactory.getByFilter(
      filters,
      sort,
      page,
      size,
      include
    );
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getProjectDocument = async (req, res) => {
  try {
    const doc = await projectDocumentFactory.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    return res.status(200).json(doc);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const downloadProjectDocument = async (req, res) => {
  try {
    const doc = await projectDocumentFactory.getById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    if (!doc.storage_file_url)
      return res.status(404).json({ message: "Storage URL unavailable" });
    return res.status(302).set("Location", doc.storage_file_url).end();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteProjectDocument = async (req, res) => {
  try {
    const id = req.params.id;
    const hard = req.query.hard_delete === "true" || req.query.hard_delete === true;
    const result = await projectDocumentService.deleteDocument(
      id,
      hard,
      req.headers["x-user-id"] || "system"
    );
    if (!result) return res.status(404).json({ message: "Not found" });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const reparseProjectDocument = async (req, res) => {
  try {
    const id = req.params.id;
    // Kick off the reparse in the background; respond immediately so the UI can poll status.
    projectDocumentService
      .reparseDocument(id, req.headers["x-user-id"] || "system")
      .catch((err) => console.log("reparse error:", err.message));
    return res.status(202).json({ message: "Reparse scheduled", id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const searchProjectDocuments = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      project_id: projectId,
      organization_id: organizationId,
      query,
      doc_types: docTypes,
      project_document_ids: projectDocumentIds,
      top_k: topK,
      max_branch: maxBranch,
      max_depth: maxDepth,
    } = body;

    if (!projectId) return res.status(400).json({ message: "project_id is required" });
    if (!query) return res.status(400).json({ message: "query is required" });

    const ragBody = {
      project_id: Number(projectId),
      organization_id: organizationId != null ? Number(organizationId) : null,
      query,
      doc_types: Array.isArray(docTypes) ? docTypes : null,
      project_document_ids: Array.isArray(projectDocumentIds)
        ? projectDocumentIds.map(Number)
        : null,
      top_k: topK ? Number(topK) : 8,
      max_branch: maxBranch ? Number(maxBranch) : 3,
      max_depth: maxDepth ? Number(maxDepth) : 5,
    };

    let result = await aiEngineClient.ragSearch(ragBody);
    if (result == null) {
      result = await ragService.selectChunks({
        projectId,
        organizationId,
        query,
        docTypes: Array.isArray(docTypes) ? docTypes : null,
        projectDocumentIds: Array.isArray(projectDocumentIds)
          ? projectDocumentIds
          : null,
        topK: ragBody.top_k,
        maxBranch: ragBody.max_branch,
        maxDepth: ragBody.max_depth,
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function normalizeConversationHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-24)
    .map((m) => ({ role: m.role, content: String(m.content).trim() }));
}

function buildNodeChatFallback(query, retrieval) {
  const chunks = retrieval.chunks || [];
  const citations = chunks.slice(0, 10).map((c) => ({
    project_document_id: c.project_document_id,
    title: c.project_document_title,
    doc_type: c.project_document_doc_type,
    section_path: c.section_path,
    heading: c.heading,
    score: c.score,
  }));

  let answer;
  if (!chunks.length) {
    answer =
      "No indexed passages matched this question. Upload documents and wait until " +
      "status is Indexed, then ask again.";
  } else {
    const blocks = chunks.slice(0, 8).map((c) => {
      const title = c.project_document_title || "Document";
      const path = c.section_path || c.heading || "";
      const body = String(c.summary || c.content || "").slice(0, 2400);
      const pathLine = path ? ` — ${path}\n` : "\n";
      return `**${title}**${pathLine}${body}`;
    });
    answer =
      "Below are the best-matching excerpts from indexed documents (AI engine unavailable; " +
      "showing passages only).\n\n---\n\n" +
      blocks.join("\n\n---\n\n") +
      `\n\n---\n\nYour question: "${query}"`;
  }

  return {
    answer,
    citations,
    chunks: chunks.slice(0, 8),
    traversal: retrieval.traversal || [],
    documents: retrieval.documents || [],
    sources: {
      ...(retrieval.sources || {}),
      answer_mode: "extractive_fallback_node",
    },
  };
}

const chatProjectDocuments = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      project_id: projectId,
      organization_id: organizationId,
      query,
      doc_types: docTypes,
      project_document_ids: projectDocumentIds,
      top_k: topK,
      max_branch: maxBranch,
      max_depth: maxDepth,
      conversation_history: conversationHistory,
    } = body;

    if (!projectId) return res.status(400).json({ message: "project_id is required" });
    if (!query || !String(query).trim())
      return res.status(400).json({ message: "query is required" });

    const q = String(query).trim();
    const chatBody = {
      project_id: Number(projectId),
      organization_id: organizationId != null ? Number(organizationId) : null,
      query: q,
      doc_types: Array.isArray(docTypes) ? docTypes : null,
      project_document_ids: Array.isArray(projectDocumentIds)
        ? projectDocumentIds.map(Number)
        : null,
      top_k: topK ? Number(topK) : 8,
      max_branch: maxBranch ? Number(maxBranch) : 3,
      max_depth: maxDepth ? Number(maxDepth) : 5,
      conversation_history: normalizeConversationHistory(conversationHistory),
    };

    let result = await aiEngineClient.ragChat(chatBody);
    if (result == null) {
      const retrieval = await ragService.selectChunks({
        projectId,
        organizationId,
        query: q,
        docTypes: Array.isArray(docTypes) ? docTypes : null,
        projectDocumentIds: Array.isArray(projectDocumentIds)
          ? projectDocumentIds
          : null,
        topK: chatBody.top_k,
        maxBranch: chatBody.max_branch,
        maxDepth: chatBody.max_depth,
      });
      result = buildNodeChatFallback(q, retrieval);
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * uploadProjectDocument is wired by routes/project-document-routes.js directly (not via the
 * express-compat wrapper) because it needs the Fastify multipart parts iterator.
 *
 * Exported for unit tests.
 */
const uploadProjectDocument = async ({
  projectId,
  organizationId,
  docType,
  title,
  version,
  description,
  author,
  language,
  fileBuffer,
  originalFilename,
  mimeType,
  uploadedBy,
}) => {
  const doc = await projectDocumentService.createDocument({
    projectId,
    organizationId,
    docType,
    title,
    version,
    description,
    author,
    language,
    fileBuffer,
    originalFilename,
    mimeType,
    uploadedBy,
  });

  // Fire-and-forget parsing; status is the contract.
  projectDocumentService
    .parseAndIndex({
      projectDocument: doc,
      fileBuffer,
      mimeType,
      modifiedBy: uploadedBy,
      skipParsingStartedNotification: true,
    })
    .catch((err) => console.log("parseAndIndex async error:", err.message));

  return doc;
};

module.exports = {
  DOC_TYPE_CATALOG,
  getDocTypes,
  getProjectDocuments,
  getProjectDocument,
  downloadProjectDocument,
  deleteProjectDocument,
  reparseProjectDocument,
  searchProjectDocuments,
  chatProjectDocuments,
  uploadProjectDocument,
};
