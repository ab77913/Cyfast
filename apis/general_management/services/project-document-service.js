"use strict";

/**
 * Project Document orchestrator.
 *
 * Coordinates the end-to-end ingestion pipeline:
 *
 *   1) Validate input (project + doc_type).
 *   2) Persist a row in `project_document` (MySQL) with status=UPLOADED.
 *   3) Upload the raw bytes to the storage_service microservice.
 *   4) Parse the file into a PageIndex-style tree (document-parser-service).
 *   5) Replace the document's chunks in MongoDB (project_document_chunk).
 *   6) Mark status=INDEXED with chunk_count / page_count.
 *
 * Parsing/indexing runs asynchronously after the HTTP response is sent so big files
 * don't block the upload request — the status field on `project_document` is the
 * source of truth for UI polling.
 */

const projectDocumentFactory = require("../database/mysql/factories/project-document-factory");
const projectDocumentChunkFactory = require("../database/mongodb/factories/project-document-chunk-factory");
const projectFactory = require("../database/mysql/factories/project-factory");
const storageClient = require("./storage-client");
const documentParser = require("./document-parser-service");
const aiEngineClient = require("./ai-engine-client");
const config = require("../config.js");
const { notifyUserFromPrincipal } = require("./async-user-notify");

function ingestionLabelFor(doc) {
  if (!doc) return "Document";
  return doc.doc_type === "EXPORTED_TEST_CASES" ? "Test cases document" : "Document";
}

function safeNotify(recipientPrincipal, payload) {
  return notifyUserFromPrincipal(recipientPrincipal, payload).catch(() => {});
}

function publishAiDocumentEvent(payload) {
  if (
    config.mq_type === "rabbitmq" &&
    config.mq_queues &&
    config.mq_queues.ai_rag_document_indexed
  ) {
    try {
      const mqProducer = require("../messaging/rabbitmq/mq-producer.js");
      mqProducer.sendToQueue(
        config.mq_queues.ai_rag_document_indexed,
        JSON.stringify(payload)
      );
    } catch (e) {
      console.log("ai_rag_document_indexed publish:", e.message);
    }
  }
}

const ALLOWED_DOC_TYPES = new Set([
  "BRD",
  "SRS",
  "FRS",
  "REGULATORY",
  "SAFETY_REQUIREMENTS",
  "EXPORTED_REQUIREMENTS",
  "EXPORTED_TEST_CASES",
  "DESIGN",
  "OTHER",
]);

function sanitizeDocType(docType) {
  if (!docType) return "OTHER";
  const up = String(docType).trim().toUpperCase();
  return ALLOWED_DOC_TYPES.has(up) ? up : "OTHER";
}

function partitionKeyFor(projectId) {
  return `project_${projectId}_documents`;
}

function folderPathFor(docType) {
  return docType ? docType.toLowerCase() : "other";
}

/**
 * Stage 1: persist DB row + upload to storage_service.
 * Returns the freshly-created project_document row.
 */
async function createDocument({
  projectId,
  organizationId,
  docType,
  title,
  version,
  description,
  author,
  language,
  source = "UPLOAD",
  fileBuffer,
  originalFilename,
  mimeType,
  uploadedBy = "system",
}) {
  if (!projectId) throw new Error("project_id is required");
  if (!fileBuffer) throw new Error("file is required");
  if (!originalFilename) throw new Error("filename is required");

  const project = await projectFactory.getById(projectId);
  if (!project) throw new Error("Project not found");

  const safeDocType = sanitizeDocType(docType);
  const resolvedOrg = organizationId || project.organization_id;

  // create initial row so UI sees an "UPLOADED / PARSING" entry immediately
  const initial = await projectDocumentFactory.add({
    organization_id: resolvedOrg,
    project_id: projectId,
    doc_type: safeDocType,
    title: title || originalFilename,
    version: version || null,
    description: description || null,
    author: author || null,
    language: language || null,
    source,
    original_filename: originalFilename,
    mime_type: mimeType || null,
    file_size: fileBuffer.length,
    status: "UPLOADED",
    created_by: uploadedBy,
  });

  if (!initial) {
    throw new Error("Failed to create project_document row");
  }

  // upload to storage_service
  let storageMeta;
  try {
    storageMeta = await storageClient.uploadBuffer({
      buffer: fileBuffer,
      filename: originalFilename,
      mimeType,
      partitionKey: partitionKeyFor(projectId),
      folderPath: folderPathFor(safeDocType),
      uploadedBy,
    });
  } catch (error) {
    await projectDocumentFactory.update(initial.project_document_id, {
      status: "FAILED",
      parse_status_detail:
        "storage_service upload failed: " + (error.message || String(error)),
      modified_by: uploadedBy,
    });
    safeNotify(uploadedBy, {
      category: "document_ingestion",
      title: `${ingestionLabelFor(initial)} upload failed`,
      body: `${
        initial.title || originalFilename || "Upload"
      }: ${error.message || String(error)}`,
      referenceType: "project_document",
      referenceId: String(initial.project_document_id),
      createdBy: uploadedBy,
    });
    throw new Error("storage_service upload failed: " + error.message);
  }

  const updated = await projectDocumentFactory.update(
    initial.project_document_id,
    {
      storage_file_id: storageMeta.file_id || storageMeta.id || null,
      storage_file_url: storageMeta.file_url || null,
      stored_filename: storageMeta.stored_filename || null,
      mime_type: storageMeta.mime_type || mimeType || null,
      file_size: storageMeta.file_size || fileBuffer.length,
      status: "PARSING",
      modified_by: uploadedBy,
    }
  );

  const refreshed = updated || initial;
  safeNotify(uploadedBy, {
    category: "document_ingestion",
    title: `${ingestionLabelFor(refreshed)} uploaded`,
    body: `"${
      refreshed.title || originalFilename
    }" is stored; parsing and indexing have started.`,
    referenceType: "project_document",
    referenceId: String(refreshed.project_document_id),
    createdBy: uploadedBy,
  });

  return refreshed;
}

/**
 * Stage 2: parse the buffer into a PageIndex tree and persist chunks to Mongo.
 * Called asynchronously by `createDocument`'s caller (or via /reparse).
 */
async function parseAndIndex({
  projectDocument,
  fileBuffer,
  mimeType,
  modifiedBy,
  skipParsingStartedNotification = false,
}) {
  const id = projectDocument.project_document_id;
  const who = modifiedBy || "system";
  try {
    await projectDocumentFactory.update(id, {
      status: "PARSING",
      parse_status_detail: null,
      modified_by: who,
    });

    if (!skipParsingStartedNotification) {
      safeNotify(who, {
        category: "document_ingestion",
        title: `${ingestionLabelFor(projectDocument)} parsing started`,
        body: `"${
          projectDocument.title || projectDocument.original_filename || id
        }" is being parsed and chunked for search.`,
        referenceType: "project_document",
        referenceId: String(id),
        createdBy: who,
      });
    }

    const parsed = await documentParser.parse(
      fileBuffer,
      mimeType || projectDocument.mime_type,
      projectDocument.original_filename
    );

    // attach IDs/metadata expected by the chunk model
    const enriched = parsed.nodes.map((n, idx) => ({
      ...n,
      project_document_id: id,
      project_id: projectDocument.project_id,
      organization_id: projectDocument.organization_id,
      doc_type: projectDocument.doc_type,
      order_index: typeof n.order_index === "number" ? n.order_index : idx,
    }));

    await projectDocumentChunkFactory.replaceForDocument(id, enriched);

    await projectDocumentFactory.update(id, {
      status: "INDEXED",
      chunk_count: parsed.leafCount,
      page_count: parsed.pageCount,
      parse_status_detail: null,
      modified_by: modifiedBy || "system",
    });

    const indexed = await projectDocumentFactory.getById(id);
    if (indexed) {
      const ev = {
        event: "DOCUMENT_INDEXED",
        project_id: indexed.project_id,
        organization_id: indexed.organization_id,
        project_document_id: indexed.project_document_id,
        doc_type: indexed.doc_type,
      };
      aiEngineClient.notifyDocumentIndexed(ev).catch(() => {});
      publishAiDocumentEvent(ev);

      safeNotify(who, {
        category: "document_ingestion",
        title: `${ingestionLabelFor(indexed)} indexed`,
        body: `"${
          indexed.title || indexed.original_filename || id
        }" finished indexing (${parsed.leafCount} chunk(s)).`,
        referenceType: "project_document",
        referenceId: String(id),
        createdBy: who,
      });
    }

    return { ok: true, leafCount: parsed.leafCount };
  } catch (error) {
    console.log("parseAndIndex error:", error);
    await projectDocumentFactory.update(id, {
      status: "FAILED",
      parse_status_detail: error.message || String(error),
      modified_by: who,
    });
    safeNotify(who, {
      category: "document_ingestion",
      title: `${ingestionLabelFor(projectDocument)} processing failed`,
      body: `${
        projectDocument.title || projectDocument.original_filename || id
      }: ${error.message || String(error)}`,
      referenceType: "project_document",
      referenceId: String(id),
      createdBy: who,
    });
    return { ok: false, error: error.message };
  }
}

/**
 * Convenience: re-parse an existing document by downloading the file back from storage_service.
 */
async function reparseDocument(projectDocumentId, modifiedBy = "system") {
  const doc = await projectDocumentFactory.getById(projectDocumentId);
  if (!doc) throw new Error("Project document not found");
  if (!doc.storage_file_url && !doc.storage_file_id) {
    throw new Error("Document has no storage reference; cannot reparse");
  }

  const buffer = doc.storage_file_url
    ? await storageClient.downloadBuffer(doc.storage_file_url)
    : (() => {
        throw new Error("storage_file_url missing");
      })();

  return parseAndIndex({
    projectDocument: doc,
    fileBuffer: buffer,
    mimeType: doc.mime_type,
    modifiedBy,
  });
}

async function deleteDocument(projectDocumentId, hardDelete = false, deletedBy = "system") {
  const doc = await projectDocumentFactory.getById(projectDocumentId);
  if (!doc) return null;

  // remove chunks regardless of soft/hard delete — they have no value after delete
  await projectDocumentChunkFactory.removeByDocument(projectDocumentId);

  if (doc.storage_file_id) {
    await storageClient.deleteFile(doc.storage_file_id, hardDelete);
  }

  if (hardDelete) {
    await projectDocumentFactory.remove(projectDocumentId);
  } else {
    await projectDocumentFactory.update(projectDocumentId, {
      status: "DELETED",
      deleted_by: deletedBy,
      deleted_date: new Date(),
    });
  }
  return { ok: true };
}

module.exports = {
  ALLOWED_DOC_TYPES,
  sanitizeDocType,
  partitionKeyFor,
  folderPathFor,
  createDocument,
  parseAndIndex,
  reparseDocument,
  deleteDocument,
};
