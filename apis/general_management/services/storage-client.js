"use strict";

/**
 * Thin client for the storage_service microservice (apis/storage_service).
 *
 * The general_management service never persists raw document bytes itself — it proxies
 * the upload to storage_service so the same partitioning, soft-delete, and metadata
 * conventions are used everywhere.
 *
 * Base URL:
 *   process.env.STORAGE_SERVICE_URL  (preferred)
 *   process.env.STORAGE_SERVICE_HOST + STORAGE_SERVICE_PORT (fallback)
 *   default: http://localhost:8092
 */

const axios = require("axios");
const FormData = require("form-data");

function getBaseUrl() {
  if (process.env.STORAGE_SERVICE_URL) {
    return process.env.STORAGE_SERVICE_URL.replace(/\/+$/, "");
  }
  const host = process.env.STORAGE_SERVICE_HOST || "localhost";
  const port = process.env.STORAGE_SERVICE_PORT || "8092";
  return `http://${host}:${port}`;
}

/**
 * Upload a single file buffer to storage_service.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.filename
 * @param {string} params.mimeType
 * @param {string} params.partitionKey    e.g. `project_${projectId}`
 * @param {string} params.folderPath      e.g. `documents/BRD`
 * @param {string} params.uploadedBy
 * @returns {Promise<Object>} the file metadata returned by storage_service
 */
const uploadBuffer = async ({
  buffer,
  filename,
  mimeType,
  partitionKey,
  folderPath = "",
  uploadedBy = "system",
}) => {
  if (!buffer) throw new Error("buffer is required");
  if (!filename) throw new Error("filename is required");
  if (!partitionKey) throw new Error("partitionKey is required");

  const form = new FormData();
  form.append("partition_key", partitionKey);
  if (folderPath) form.append("folder_path", folderPath);
  form.append("uploaded_by", uploadedBy);
  form.append("file", buffer, {
    filename: filename,
    contentType: mimeType || "application/octet-stream",
  });

  const url = `${getBaseUrl()}/storage/upload`;
  const response = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      "x-user-id": uploadedBy,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 5 * 60 * 1000,
  });

  const payload = response.data || {};
  // storage_service.uploadFiles wraps single uploads in `data: [fileMetadata]`
  const meta = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  if (!meta) {
    throw new Error(
      "storage_service did not return file metadata: " +
        JSON.stringify(payload).slice(0, 400)
    );
  }
  return meta;
};

const deleteFile = async (fileId, hardDelete = false) => {
  if (!fileId) return null;
  const url = `${getBaseUrl()}/storage/files/${encodeURIComponent(fileId)}?hard_delete=${
    hardDelete ? "true" : "false"
  }`;
  try {
    const response = await axios.delete(url, { timeout: 30 * 1000 });
    return response.data;
  } catch (error) {
    console.log("storage_service deleteFile error:", error.message);
    return null;
  }
};

const downloadBuffer = async (fileUrl) => {
  if (!fileUrl) throw new Error("fileUrl is required");
  // file_url may be relative ("/files/...") or absolute — handle both.
  const url = /^https?:/i.test(fileUrl) ? fileUrl : `${getBaseUrl()}${fileUrl}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 5 * 60 * 1000,
  });
  return Buffer.from(response.data);
};

const getFileById = async (fileId) => {
  try {
    const url = `${getBaseUrl()}/storage/files/${encodeURIComponent(fileId)}`;
    const response = await axios.get(url, { timeout: 30 * 1000 });
    return response.data?.data || null;
  } catch (error) {
    console.log("storage_service getFileById error:", error.message);
    return null;
  }
};

module.exports = {
  getBaseUrl,
  uploadBuffer,
  deleteFile,
  downloadBuffer,
  getFileById,
};
