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
      title: "CyFAST Report Management API",
      version: "1.0.0",
      description:
        "Report design templates, sections, templates, and generation (HTML, PDF, Word).",
    },
    servers: [{ url: config.url }],
    tags: [
      { name: "Health" },
      { name: "Design templates" },
      { name: "Report sections" },
      { name: "Report templates" },
      { name: "Reports" },
    ],
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Service check",
          responses: { 200: { description: "OK" } },
        },
      },
      "/design_templates": {
        get: {
          tags: ["Design templates"],
          summary: "List design templates",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Design templates"],
          summary: "Create design template (multipart file)",
          responses: { 200: { description: "OK" } },
        },
      },
      "/design_templates/{designTemplateId}": {
        parameters: [
          {
            name: "designTemplateId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Design templates"],
          summary: "Get design template",
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Design templates"],
          summary: "Delete design template",
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_sections": {
        get: {
          tags: ["Report sections"],
          summary: "List report sections",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Report sections"],
          summary: "Create report section",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_sections/add_default": {
        post: {
          tags: ["Report sections"],
          summary: "Add default report sections",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_sections/{reportSectionId}": {
        parameters: [
          {
            name: "reportSectionId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Report sections"],
          summary: "Get report section",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Report sections"],
          summary: "Update report section",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Report sections"],
          summary: "Delete report section",
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_templates": {
        get: {
          tags: ["Report templates"],
          summary: "List report templates",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Report templates"],
          summary: "Create report template",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_templates/{reportTemplateId}": {
        parameters: [
          {
            name: "reportTemplateId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        get: {
          tags: ["Report templates"],
          summary: "Get report template",
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Report templates"],
          summary: "Update report template",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Report templates"],
          summary: "Delete report template",
          responses: { 200: { description: "OK" } },
        },
      },
      "/report_templates/{reportTemplateId}/set_default": {
        parameters: [
          {
            name: "reportTemplateId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        post: {
          tags: ["Report templates"],
          summary: "Set default report template",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/reports/generate": {
        get: {
          tags: ["Reports"],
          summary: "Generate report",
          responses: { 200: { description: "OK" } },
        },
      },
      "/reports/download": {
        get: {
          tags: ["Reports"],
          summary: "Download report",
          responses: { 200: { description: "File or payload" } },
        },
      },
      "/reports/preview": {
        post: {
          tags: ["Reports"],
          summary: "Preview report",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/reports/wordtoword": {
        get: {
          tags: ["Reports"],
          summary: "Word-to-word transform",
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
}

module.exports = { buildOpenApiSpec };
