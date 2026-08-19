"use strict";

const db = require("../models");
const FileMetadata = db.FileMetadata;

/**
 * Create file metadata record
 * @param {Object} fileData - File metadata
 * @returns {Promise<Object>} Created file metadata
 */
const create = async (fileData) => {
  try {
    const fileMetadata = new FileMetadata(fileData);
    const savedFile = await fileMetadata.save();
    return savedFile.toJSON();
  } catch (error) {
    console.error("Error creating file metadata:", error);
    throw error;
  }
};

/**
 * Create multiple file metadata records
 * @param {Array} filesData - Array of file metadata
 * @returns {Promise<Array>} Created file metadata records
 */
const createMany = async (filesData) => {
  try {
    const files = await FileMetadata.insertMany(filesData);
    return files.map(file => file.toJSON());
  } catch (error) {
    console.error("Error creating multiple file metadata:", error);
    throw error;
  }
};

/**
 * Get file metadata by ID
 * @param {String} fileId - File ID
 * @returns {Promise<Object|null>} File metadata
 */
const getById = async (fileId) => {
  try {
    const file = await FileMetadata.findOne({ 
      file_id: fileId, 
      is_deleted: false 
    });
    return file ? file.toJSON() : null;
  } catch (error) {
    console.error("Error getting file by ID:", error);
    throw error;
  }
};

/**
 * Get files by partition key
 * @param {String} partitionKey - Partition key
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Files with pagination
 */
const getByPartition = async (partitionKey, options = {}) => {
  try {
    const {
      folderPath = null,
      page = 1,
      limit = 50,
      sort = { created_at: -1 }
    } = options;

    const query = { 
      partition_key: partitionKey, 
      is_deleted: false 
    };

    if (folderPath) {
      query.folder_path = folderPath;
    }

    const skip = (page - 1) * limit;

    const files = await FileMetadata.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip);

    const total = await FileMetadata.countDocuments(query);

    return {
      data: files.map(file => file.toJSON()),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error("Error getting files by partition:", error);
    throw error;
  }
};

/**
 * Get files by folder path
 * @param {String} partitionKey - Partition key
 * @param {String} folderPath - Folder path
 * @returns {Promise<Array>} Files
 */
const getByFolder = async (partitionKey, folderPath) => {
  try {
    const files = await FileMetadata.find({
      partition_key: partitionKey,
      folder_path: folderPath,
      is_deleted: false
    }).sort({ created_at: -1 });

    return files.map(file => file.toJSON());
  } catch (error) {
    console.error("Error getting files by folder:", error);
    throw error;
  }
};

/**
 * Search files
 * @param {Object} searchCriteria - Search criteria
 * @returns {Promise<Array>} Files
 */
const search = async (searchCriteria) => {
  try {
    const query = { is_deleted: false, ...searchCriteria };
    const files = await FileMetadata.find(query).sort({ created_at: -1 });
    return files.map(file => file.toJSON());
  } catch (error) {
    console.error("Error searching files:", error);
    throw error;
  }
};

/**
 * Soft delete file
 * @param {String} fileId - File ID
 * @returns {Promise<Object|null>} Updated file metadata
 */
const softDelete = async (fileId) => {
  try {
    const file = await FileMetadata.findOneAndUpdate(
      { file_id: fileId, is_deleted: false },
      { 
        is_deleted: true, 
        deleted_at: new Date() 
      },
      { new: true }
    );
    return file ? file.toJSON() : null;
  } catch (error) {
    console.error("Error soft deleting file:", error);
    throw error;
  }
};

/**
 * Hard delete file metadata
 * @param {String} fileId - File ID
 * @returns {Promise<Boolean>} Success status
 */
const hardDelete = async (fileId) => {
  try {
    const result = await FileMetadata.deleteOne({ file_id: fileId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error("Error hard deleting file:", error);
    throw error;
  }
};

/**
 * Update file metadata
 * @param {String} fileId - File ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated file metadata
 */
const update = async (fileId, updateData) => {
  try {
    const file = await FileMetadata.findOneAndUpdate(
      { file_id: fileId },
      updateData,
      { new: true }
    );
    return file ? file.toJSON() : null;
  } catch (error) {
    console.error("Error updating file metadata:", error);
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
    const match = { is_deleted: false };
    if (partitionKey) {
      match.partition_key = partitionKey;
    }

    const stats = await FileMetadata.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$partition_key",
          total_files: { $sum: 1 },
          total_size: { $sum: "$file_size" }
        }
      }
    ]);

    return stats;
  } catch (error) {
    console.error("Error getting storage stats:", error);
    throw error;
  }
};

module.exports = {
  create,
  createMany,
  getById,
  getByPartition,
  getByFolder,
  search,
  softDelete,
  hardDelete,
  update,
  getStorageStats
};
