"use strict";

/** @param {object} config */
function buildOpenApiDoc(config) {
  const jsonBody = {
    requestBody: {
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: true },
        },
      },
    },
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "CyFAST User Management API",
      version: "3.0.0",
      description: "Authentication, users, roles, and permissions.",
    },
    servers: [{ url: config.url }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Users" },
      { name: "Roles" },
      { name: "Permissions" },
    ],
    paths: {
      "/": {
        get: {
          tags: ["Health"],
          summary: "Service check",
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Current user from token",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          ...jsonBody,
          responses: { 200: { description: "Tokens and user" } },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/forgot_password": {
        post: {
          tags: ["Auth"],
          summary: "Forgot password",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/auth/reset_password": {
        post: {
          tags: ["Auth"],
          summary: "Reset password",
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/users": {
        get: {
          tags: ["Users"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Users"],
          summary: "Create user",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/users/my-profile": {
        get: {
          tags: ["Users"],
          summary: "My profile",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/users/roles/simple": {
        get: {
          tags: ["Users"],
          summary: "Simple roles list (under users prefix)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/users/{userId}": {
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        get: {
          tags: ["Users"],
          summary: "Get user",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Users"],
          summary: "Update user",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        put: {
          tags: ["Users"],
          summary: "Update user (PUT)",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Users"],
          summary: "Delete user",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/roles": {
        get: {
          tags: ["Roles"],
          summary: "List roles",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Roles"],
          summary: "Create role",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/roles/roles/simple": {
        get: {
          tags: ["Roles"],
          summary: "Simple roles list",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/roles/{roleId}": {
        parameters: [
          {
            name: "roleId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        get: {
          tags: ["Roles"],
          summary: "Get role",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Roles"],
          summary: "Update role",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Roles"],
          summary: "Delete role",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
      "/permissions": {
        get: {
          tags: ["Permissions"],
          summary: "List permissions",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Permissions"],
          summary: "Create permission",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
      },
      "/permissions/{permissionId}": {
        parameters: [
          {
            name: "permissionId",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        get: {
          tags: ["Permissions"],
          summary: "Get permission",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
        post: {
          tags: ["Permissions"],
          summary: "Update permission",
          security: [{ bearerAuth: [] }],
          ...jsonBody,
          responses: { 200: { description: "OK" } },
        },
        delete: {
          tags: ["Permissions"],
          summary: "Delete permission",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "OK" } },
        },
      },
    },
  };
}

module.exports = { buildOpenApiDoc };
