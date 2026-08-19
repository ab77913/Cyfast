"use strict";

const storageService = require("../services/storage-service");
const fileMetadataFactory = require("../database/mongodb/factories/fileMetadataFactory");
const { requestLogger } = require("../helpers/logger");
const { assertInternalAuth } = require("../../general_management/services/windows/windows-security-config");

/**
 * Upload file(s)
 * POST /storage/upload
 */
const uploadFiles = async (request, reply) => {
  const log = requestLogger(request);

  try {
    log.info("Upload request received");

    if (!request.isMultipart()) {
      return reply.code(400).send({
        success: false,
        message: "Request must be multipart/form-data"
      });
    }

    const fields = {};
    const files = [];

    // Multipart parts must be consumed in a single sequential iteration.
    // Buffer each file as we go so the upstream service does not need to
    // re-read a stream that has already advanced.
    for await (const part of request.parts()) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        files.push({
          filename: part.filename,
          mimetype: part.mimetype,
          encoding: part.encoding,
          fieldname: part.fieldname,
          _buffer: buffer,
          toBuffer: async () => buffer
        });
      } else {
        fields[part.fieldname] = part.value;
      }
    }

    if (files.length === 0) {
      return reply.code(400).send({
        success: false,
        message: "No file provided"
      });
    }

    const partitionKey =
      fields.partition_key || request.query.partition_key || "default";
    const folderPath =
      fields.folder_path || request.query.folder_path || "";
    const uploadedBy =
      fields.uploaded_by || request.headers["x-user-id"] || "system";

    log.info("Upload parameters", {
      partitionKey,
      folderPath,
      fileCount: files.length
    });

    const uploadedFiles =
      files.length === 1
        ? [
            await storageService.uploadFile(
              files[0],
              partitionKey,
              folderPath,
              uploadedBy
            )
          ]
        : await storageService.uploadMultipleFiles(
            files,
            partitionKey,
            folderPath,
            uploadedBy
          );

    log.info("Files uploaded successfully", { count: uploadedFiles.length });

    return reply.code(201).send({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: uploadedFiles,
      urls: uploadedFiles.map(f => f.file_url),
      paths: uploadedFiles.map(f => f.file_path)
    });
  } catch (error) {
    log.error("Error uploading files", error);

    return reply.code(500).send({
      success: false,
      message: "Error uploading files",
      error: error.message
    });
  }
};

/**
 * Get file by ID
 * GET /storage/files/:fileId
 */
const getFileById = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const { fileId } = request.params;
    
    log.info("Get file request", { fileId });
    
    const fileMetadata = await fileMetadataFactory.getById(fileId);
    
    if (!fileMetadata) {
      return reply.code(404).send({
        success: false,
        message: "File not found"
      });
    }
    
    return reply.code(200).send({
      success: true,
      data: fileMetadata
    });
    
  } catch (error) {
    log.error("Error getting file", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error retrieving file",
      error: error.message
    });
  }
};

/**
 * List files by partition
 * GET /storage/list
 */
const listFiles = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const { 
      partition_key, 
      folder_path, 
      page = 1, 
      limit = 50 
    } = request.query;
    
    if (!partition_key) {
      return reply.code(400).send({
        success: false,
        message: "partition_key is required"
      });
    }
    
    log.info("List files request", { partition_key, folder_path });
    
    const result = await fileMetadataFactory.getByPartition(partition_key, {
      folderPath: folder_path,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    return reply.code(200).send({
      success: true,
      ...result
    });
    
  } catch (error) {
    log.error("Error listing files", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error listing files",
      error: error.message
    });
  }
};

/**
 * Delete file(s)
 * DELETE /storage/delete
 */
const deleteFiles = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const { file_id, file_ids, hard_delete = false } = request.body;
    
    if (!file_id && !file_ids) {
      return reply.code(400).send({
        success: false,
        message: "file_id or file_ids is required"
      });
    }
    
    log.info("Delete request", { file_id, file_ids, hard_delete });
    
    let result;
    
    if (file_ids && Array.isArray(file_ids)) {
      // Delete multiple files
      result = await storageService.deleteMultipleFiles(file_ids, hard_delete);
    } else {
      // Delete single file
      result = await storageService.deleteFile(file_id, hard_delete);
    }
    
    return reply.code(200).send({
      success: true,
      ...result
    });
    
  } catch (error) {
    log.error("Error deleting files", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error deleting files",
      error: error.message
    });
  }
};

/**
 * Delete file by ID (path parameter)
 * DELETE /storage/files/:fileId
 */
const deleteFileById = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const { fileId } = request.params;
    const { hard_delete = false } = request.query;
    
    log.info("Delete file request", { fileId, hard_delete });
    
    const result = await storageService.deleteFile(fileId, hard_delete === 'true');
    
    return reply.code(200).send({
      success: true,
      ...result
    });
    
  } catch (error) {
    log.error("Error deleting file", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error deleting file",
      error: error.message
    });
  }
};

/**
 * Get storage statistics
 * GET /storage/stats
 */
const getStats = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const { partition_key } = request.query;
    
    log.info("Get stats request", { partition_key });
    
    const stats = await storageService.getStorageStats(partition_key);
    
    return reply.code(200).send({
      success: true,
      data: stats
    });
    
  } catch (error) {
    log.error("Error getting stats", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error retrieving storage statistics",
      error: error.message
    });
  }
};

/**
 * Search files
 * POST /storage/search
 */
const searchFiles = async (request, reply) => {
  const log = requestLogger(request);
  
  try {
    const searchCriteria = request.body;
    
    log.info("Search request", searchCriteria);
    
    const files = await fileMetadataFactory.search(searchCriteria);
    
    return reply.code(200).send({
      success: true,
      data: files,
      count: files.length
    });
    
  } catch (error) {
    log.error("Error searching files", error);
    
    return reply.code(500).send({
      success: false,
      message: "Error searching files",
      error: error.message
    });
  }
};

/**
 * Health check
 * GET /health
 */
const healthCheck = async (request, reply) => {
  return reply.code(200).send({
    success: true,
    message: "Storage service is running",
    timestamp: new Date().toISOString()
  });
};

// Windows evidence is never returned through the legacy public /files route.
// GM authorizes the user, then calls this endpoint with its service credential.
const getInternalFileContent = async (request, reply) => {
  try {
    assertInternalAuth(request.headers.authorization);
    const value = await storageService.getFileStream(request.params.fileId);
    reply.type(value.metadata.mime_type || "application/octet-stream");
    return reply.send(require("fs").createReadStream(value.filePath));
  } catch (error) {
    if (error.code === "INTERNAL_AUTH_REQUIRED" || error.code === "CONFIGURATION_ERROR") {
      return reply.code(error.statusCode || 500).send({ code: error.code, message: error.message });
    }
    return reply.code(404).send({ code: "FILE_NOT_FOUND", message: error.message });
  }
};

module.exports = {
  uploadFiles,
  getFileById,
  listFiles,
  deleteFiles,
  deleteFileById,
  getStats,
  searchFiles,
  healthCheck,
  getInternalFileContent
};
