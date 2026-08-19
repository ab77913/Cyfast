"use strict";

const storageController = require("../controllers/storage-controller");

/**
 * Register storage routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Route options
 */
async function storageRoutes(fastify, options) {
  
  // Health check
  fastify.get("/health", storageController.healthCheck);
  
  // Upload file(s)
  fastify.post("/storage/upload", storageController.uploadFiles);
  
  // List files by partition
  fastify.get("/storage/list", storageController.listFiles);
  
  // Get file metadata by ID
  fastify.get("/storage/files/:fileId", storageController.getFileById);
  fastify.get("/storage/internal/files/:fileId/content", storageController.getInternalFileContent);
  
  // Delete file by ID
  fastify.delete("/storage/files/:fileId", storageController.deleteFileById);
  
  // Delete file(s) (bulk)
  fastify.delete("/storage/delete", storageController.deleteFiles);
  
  // Get storage statistics
  fastify.get("/storage/stats", storageController.getStats);
  
  // Search files
  fastify.post("/storage/search", storageController.searchFiles);
}

module.exports = storageRoutes;
