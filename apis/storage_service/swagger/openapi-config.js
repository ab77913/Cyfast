"use strict";

/**
 * OpenAPI root document for @fastify/swagger.
 * Path operations are filled from registered routes; per-route request/response
 * details are supplied by `swagger/swagger-transform.js` because dynamic mode
 * overwrites manual `paths` with route schemas.
 *
 * @param {object} config
 */
function buildOpenApiDoc(config) {
  return {
    openapi: "3.0.3",
    info: {
      title: "CyFAST Storage Service API",
      version: "1.0.0",
      description: "File upload, metadata, and static file serving.",
    },
    servers: [{ url: config.url }],
    tags: [
      { name: "Health" },
      { name: "Storage" },
    ],
  };
}

module.exports = { buildOpenApiDoc };
