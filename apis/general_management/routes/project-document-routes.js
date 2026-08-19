"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const projectDocumentController = require("../controllers/project-document-controller");

/**
 * Routes for Gen AI V&V project documents.
 *
 * Multipart upload is consumed natively by Fastify (not via the express-compat wrapper) so
 * we can stream parts into a buffer once and pass it to the controller.
 */
async function projectDocumentRoutes(fastify) {
  fastify.get("/", wrap(projectDocumentController.getProjectDocuments));

  // Multipart upload — consumed via Fastify request.parts() and then handed off to the
  // controller's plain `uploadProjectDocument` function.
  fastify.post("/upload", async function (request, reply) {
    if (!request.isMultipart || !request.isMultipart()) {
      return reply.code(400).send({
        success: false,
        message: "Request must be multipart/form-data",
      });
    }

    const fields = {};
    let file = null;

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname !== "file") {
            // drain unexpected file fields
            await part.toBuffer();
            continue;
          }
          const buffer = await part.toBuffer();
          file = {
            buffer,
            filename: part.filename,
            mimeType: part.mimetype,
          };
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } catch (error) {
      return reply.code(400).send({
        success: false,
        message: "Failed to parse upload: " + error.message,
      });
    }

    if (!file) {
      return reply.code(400).send({
        success: false,
        message: "No file provided in 'file' field",
      });
    }

    const projectId = fields.project_id ? Number(fields.project_id) : null;
    if (!projectId) {
      return reply.code(400).send({
        success: false,
        message: "project_id is required",
      });
    }

    try {
      const doc = await projectDocumentController.uploadProjectDocument({
        projectId,
        organizationId: fields.organization_id
          ? Number(fields.organization_id)
          : null,
        docType: fields.doc_type,
        title: fields.title,
        version: fields.version,
        description: fields.description,
        author: fields.author,
        language: fields.language,
        fileBuffer: file.buffer,
        originalFilename: file.filename,
        mimeType: file.mimeType,
        uploadedBy:
          request.headers["x-user-id"] || fields.uploaded_by || "system",
      });

      return reply.code(201).send({
        success: true,
        message: "Document uploaded; parsing in progress",
        data: doc,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: error.message,
      });
    }
  });

  fastify.get("/doc_types", wrap(projectDocumentController.getDocTypes));

  fastify.post("/search", wrap(projectDocumentController.searchProjectDocuments));

  fastify.post("/chat", wrap(projectDocumentController.chatProjectDocuments));

  fastify.get(
    "/:id/download",
    wrap(projectDocumentController.downloadProjectDocument)
  );
  fastify.post(
    "/:id/reparse",
    wrap(projectDocumentController.reparseProjectDocument)
  );

  fastify.get("/:id", wrap(projectDocumentController.getProjectDocument));
  fastify.delete("/:id", wrap(projectDocumentController.deleteProjectDocument));
}

module.exports = projectDocumentRoutes;
