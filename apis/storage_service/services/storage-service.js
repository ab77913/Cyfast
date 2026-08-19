"use strict";

const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const fileMetadataFactory = require("../database/mongodb/factories/fileMetadataFactory");
const { error: logError, info: logInfo } = require("../helpers/logger");

/**
 * Ensure directory exists
 * @param {String} dirPath - Directory path
 */
const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    logError("Error creating directory", error);
    throw error;
  }
};

/**
 * Upload single file
 * @param {Object} file - File data from multipart
 * @param {String} partitionKey - Partition key
 * @param {String} folderPath - Folder path
 * @param {String} uploadedBy - User identifier
 * @returns {Promise<Object>} File metadata
 */
const uploadFile = async (file, partitionKey, folderPath = "", uploadedBy = "system") => {
  try {
    // Generate unique file ID
    const fileId = uuidv4();
    
    // Get file extension
    const ext = path.extname(file.filename);
    const storedFilename = `${fileId}${ext}`;
    
    // Build storage path: storage/partition_key/folder_path/
    const partitionDir = path.join(config.storage_path, partitionKey);
    const fullDir = folderPath 
      ? path.join(partitionDir, folderPath)
      : partitionDir;
    
    // Ensure directory exists
    await ensureDirectoryExists(fullDir);
    
    // Full file path
    const filePath = path.join(fullDir, storedFilename);
    
    // Write file to disk
    const fileBuffer = await file.toBuffer();
    await fs.writeFile(filePath, fileBuffer);
    
    // Get file size
    const stats = await fs.stat(filePath);
    
    // Build file URL
    const urlPath = folderPath 
      ? `${partitionKey}/${folderPath}/${storedFilename}`
      : `${partitionKey}/${storedFilename}`;
    const fileUrl = `${config.url}/files/${urlPath}`;
    
    // Create metadata record
    const fileMetadata = {
      file_id: fileId,
      partition_key: partitionKey,
      folder_path: folderPath || "",
      original_filename: file.filename,
      stored_filename: storedFilename,
      file_path: filePath,
      file_url: fileUrl,
      mime_type: file.mimetype,
      file_size: stats.size,
      encoding: file.encoding,
      uploaded_by: uploadedBy
    };
    
    const savedMetadata = await fileMetadataFactory.create(fileMetadata);
    
    logInfo("File uploaded successfully", { fileId, filename: file.filename });
    
    return savedMetadata;
  } catch (error) {
    logError("Error uploading file", error);
    throw error;
  }
};

/**
 * Upload multiple files
 * @param {Array} files - Array of files
 * @param {String} partitionKey - Partition key
 * @param {String} folderPath - Folder path
 * @param {String} uploadedBy - User identifier
 * @returns {Promise<Array>} Array of file metadata
 */
const uploadMultipleFiles = async (files, partitionKey, folderPath = "", uploadedBy = "system") => {
  try {
    const uploadedFiles = [];
    
    for (const file of files) {
      const metadata = await uploadFile(file, partitionKey, folderPath, uploadedBy);
      uploadedFiles.push(metadata);
    }
    
    logInfo("Multiple files uploaded successfully", { count: files.length });
    
    return uploadedFiles;
  } catch (error) {
    logError("Error uploading multiple files", error);
    throw error;
  }
};

/**
 * Delete file
 * @param {String} fileId - File ID
 * @param {Boolean} hardDelete - Whether to hard delete (remove from disk)
 * @returns {Promise<Object>} Deletion result
 */
const deleteFile = async (fileId, hardDelete = false) => {
  try {
    // Get file metadata
    const fileMetadata = await fileMetadataFactory.getById(fileId);
    
    if (!fileMetadata) {
      throw new Error("File not found");
    }
    
    if (hardDelete) {
      // Delete physical file
      try {
        await fs.unlink(fileMetadata.file_path);
        logInfo("Physical file deleted", { fileId, path: fileMetadata.file_path });
      } catch (error) {
        logError("Error deleting physical file", error);
        // Continue with metadata deletion even if file doesn't exist
      }
      
      // Delete metadata
      await fileMetadataFactory.hardDelete(fileId);
      
      return { 
        success: true, 
        message: "File deleted permanently",
        fileId 
      };
    } else {
      // Soft delete
      await fileMetadataFactory.softDelete(fileId);
      
      return { 
        success: true, 
        message: "File marked as deleted",
        fileId 
      };
    }
  } catch (error) {
    logError("Error deleting file", error);
    throw error;
  }
};

/**
 * Delete multiple files
 * @param {Array} fileIds - Array of file IDs
 * @param {Boolean} hardDelete - Whether to hard delete
 * @returns {Promise<Object>} Deletion results
 */
const deleteMultipleFiles = async (fileIds, hardDelete = false) => {
  try {
    const results = {
      success: [],
      failed: []
    };
    
    for (const fileId of fileIds) {
      try {
        const result = await deleteFile(fileId, hardDelete);
        results.success.push(result);
      } catch (error) {
        results.failed.push({ fileId, error: error.message });
      }
    }
    
    logInfo("Multiple files deletion completed", { 
      successCount: results.success.length,
      failedCount: results.failed.length 
    });
    
    return results;
  } catch (error) {
    logError("Error deleting multiple files", error);
    throw error;
  }
};

/**
 * Get file stream
 * @param {String} fileId - File ID
 * @returns {Promise<Object>} File stream and metadata
 */
const getFileStream = async (fileId) => {
  try {
    const fileMetadata = await fileMetadataFactory.getById(fileId);
    
    if (!fileMetadata) {
      throw new Error("File not found");
    }
    
    // Check if file exists
    try {
      await fs.access(fileMetadata.file_path);
    } catch (error) {
      throw new Error("Physical file not found on disk");
    }
    
    return {
      filePath: fileMetadata.file_path,
      metadata: fileMetadata
    };
  } catch (error) {
    logError("Error getting file stream", error);
    throw error;
  }
};

/**
 * Get storage statistics
 * @param {String} partitionKey - Partition key (optional)
 * @returns {Promise<Object>} Storage statistics
 */
const getStorageStats = async (partitionKey = null) => {
  try {
    const stats = await fileMetadataFactory.getStorageStats(partitionKey);
    return stats;
  } catch (error) {
    logError("Error getting storage stats", error);
    throw error;
  }
};

module.exports = {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  deleteMultipleFiles,
  getFileStream,
  getStorageStats,
  ensureDirectoryExists
};
