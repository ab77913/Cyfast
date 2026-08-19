"use strict";

const jsonBody = {
  requestBody: {
    content: {
      "application/json": {
        schema: { type: "object", additionalProperties: true },
      },
    },
  },
};

/** @param {object} config */
function buildOpenApiSpec(config) {
  return {
    openapi: "3.0.3",
    info: {
      title: "CyFAST Logger Service API",
      version: "1.0.0",
      description:
        "Application, activity, audit, console, and execution logs. Console stream may also be ingested via RabbitMQ.",
    },
    servers: [{ url: config.url }],
    tags: [
      { name: "Health" },
      { name: "Application logs" },
      { name: "Activity logs" },
      { name: "Audit logs" },
      { name: "Console logs" },
      { name: "Execution logs" },
    ],
    paths: {
      "/logs": {
        get: {
          tags: ["Health"],
          summary: "Logger service check",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/application": {
        get: {
          tags: ["Application logs"],
          summary: "List application logs",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Application logs"],
          summary: "Create application log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/application/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Application logs"],
          summary: "Get application log by id",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/activity": {
        get: {
          tags: ["Activity logs"],
          summary: "List activity logs",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Activity logs"],
          summary: "Create activity log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/activity/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Activity logs"],
          summary: "Get activity log by id",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/audit": {
        get: {
          tags: ["Audit logs"],
          summary: "List audit logs",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Audit logs"],
          summary: "Create audit log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/audit/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Audit logs"],
          summary: "Get audit log by id",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/console": {
        get: {
          tags: ["Console logs"],
          summary: "List console logs",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Console logs"],
          summary: "Create console log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/console/publish": {
        post: {
          tags: ["Console logs"],
          summary: "Publish console log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/console/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Console logs"],
          summary: "Get console log by id",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/execution": {
        get: {
          tags: ["Execution logs"],
          summary: "List execution logs",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Execution logs"],
          summary: "Create execution log",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/execution/upload": {
        post: {
          tags: ["Execution logs"],
          summary: "Upload execution log (multipart)",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/execution/orchestration_execution/{execution_id}": {
        parameters: [
          {
            name: "execution_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Execution logs"],
          summary: "Get orchestration execution logs",
          responses: { 200: { description: "OK" } },
        },
      },
      "/logs/execution/orchestration_execution/{execution_id}/reports/download/all": {
        parameters: [
          {
            name: "execution_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Execution logs"],
          summary: "Download all reports for an orchestration execution",
          responses: { 200: { description: "Archive or file" } },
        },
      },
      "/logs/execution/orchestration_execution/{execution_id}/reports/{report_file}": {
        parameters: [
          {
            name: "execution_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "report_file",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Execution logs"],
          summary: "Get a single orchestration execution report file",
          responses: { 200: { description: "File" } },
        },
      },
      "/logs/execution/{id}": {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Execution logs"],
          summary: "Get execution log by id",
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
}

module.exports = { buildOpenApiSpec };
