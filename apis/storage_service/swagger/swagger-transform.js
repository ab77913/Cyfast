"use strict";

/**
 * @fastify/swagger dynamic mode rebuilds each path from route schemas and
 * overwrites manual `openapi.paths`. Routes here have no Fastify schema, so
 * we inject documentation-only schemas via `transform` (not used for request validation).
 */

const TAG_HEALTH = ["Health"];
const TAG_STORAGE = ["Storage"];

/** @param {import('fastify').RouteOptions} route */
function routeDocKey(route) {
  const m = route.method;
  const method = Array.isArray(m) ? m[0] : m;
  return `${String(method).toUpperCase()}:${route.url}`;
}

/** @type {Record<string, Record<string, unknown>>} */
const ROUTE_DOCS = {
  "GET:/health": {
    tags: TAG_HEALTH,
    summary: "Health check",
    description: "Liveness probe.",
    response: {
      200: {
        description: "OK",
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
    },
  },

  "POST:/storage/upload": {
    tags: TAG_STORAGE,
    summary: "Upload file(s) (multipart)",
    description:
      "Send multipart/form-data. Field `file` is the primary file; you may add more file parts (any names) up to the server limit. Optional uploader via `uploaded_by` or header `x-user-id`.",
    consumes: ["multipart/form-data"],
    body: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "File to upload",
        },
        partition_key: {
          type: "string",
          description: "Partition / container key (defaults to default on server)",
        },
        folder_path: {
          type: "string",
          description: "Optional folder path within the partition",
        },
        uploaded_by: {
          type: "string",
          description: "Uploader id (optional if x-user-id header is set)",
        },
      },
    },
    response: {
      201: {
        description: "Created",
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: { type: "array" },
          urls: { type: "array", items: { type: "string" } },
          paths: { type: "array", items: { type: "string" } },
        },
      },
      400: { description: "No file or bad request", type: "object" },
      500: { description: "Server error", type: "object" },
    },
  },

  "GET:/storage/list": {
    tags: TAG_STORAGE,
    summary: "List files by partition",
    querystring: {
      type: "object",
      required: ["partition_key"],
      properties: {
        partition_key: { type: "string", description: "Required partition key" },
        folder_path: { type: "string" },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, default: 50 },
      },
    },
    response: {
      200: {
        description: "OK",
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array" },
          pagination: { type: "object" },
        },
      },
    },
  },

  "GET:/storage/files/:fileId": {
    tags: TAG_STORAGE,
    summary: "Get file metadata",
    params: {
      type: "object",
      required: ["fileId"],
      properties: {
        fileId: { type: "string", description: "File UUID" },
      },
    },
    response: {
      200: {
        description: "OK",
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object" },
        },
      },
      404: { description: "Not found", type: "object" },
    },
  },

  "DELETE:/storage/files/:fileId": {
    tags: TAG_STORAGE,
    summary: "Delete file by id",
    params: {
      type: "object",
      required: ["fileId"],
      properties: {
        fileId: { type: "string" },
      },
    },
    querystring: {
      type: "object",
      properties: {
        hard_delete: {
          type: "boolean",
          default: false,
          description: "If true, permanently removes file from disk and metadata",
        },
      },
    },
    response: {
      200: { description: "OK", type: "object" },
    },
  },

  "DELETE:/storage/delete": {
    tags: TAG_STORAGE,
    summary: "Bulk delete files",
    body: {
      type: "object",
      properties: {
        file_id: { type: "string", description: "Single file id" },
        file_ids: {
          type: "array",
          items: { type: "string" },
          description: "Multiple file ids",
        },
        hard_delete: { type: "boolean", default: false },
      },
    },
    response: {
      200: { description: "OK", type: "object" },
    },
  },

  "GET:/storage/stats": {
    tags: TAG_STORAGE,
    summary: "Storage statistics",
    querystring: {
      type: "object",
      properties: {
        partition_key: {
          type: "string",
          description: "If omitted, aggregates all partitions",
        },
      },
    },
    response: {
      200: {
        description: "OK",
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array" },
        },
      },
    },
  },

  "POST:/storage/search": {
    tags: TAG_STORAGE,
    summary: "Search files by metadata",
    description:
      "JSON body is merged with { is_deleted: false } for the metadata query. Use MongoDB-compatible field filters.",
    body: {
      type: "object",
      properties: {
        partition_key: { type: "string" },
        mime_type: { type: "string" },
        original_filename: { type: "string" },
        uploaded_by: { type: "string" },
        metadata: { type: "object", additionalProperties: true },
      },
      additionalProperties: true,
    },
    response: {
      200: {
        description: "OK",
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "array" },
          count: { type: "integer" },
        },
      },
    },
  },
};

/**
 * @param {{ schema?: import('fastify').FastifySchema; url: string; route: import('fastify').RouteOptions }} ctx
 */
function swaggerTransform(ctx) {
  const key = routeDocKey(ctx.route);
  const doc = ROUTE_DOCS[key];
  if (!doc) {
    return {};
  }
  return {
    schema: {
      ...(ctx.schema || {}),
      ...doc,
    },
  };
}

module.exports = { swaggerTransform };
