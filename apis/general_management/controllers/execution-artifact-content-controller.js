"use strict";

const axios = require("axios");
const store = require("../services/execution/execution-store");
const authz = require("../services/execution/execution-authz");
const { getInternalApiToken } = require("../services/windows/windows-security-config");

async function artifactContent(request, reply) {
  try {
    const projectId = request.query?.project_id || request.headers["x-project-id"];
    const actor = await authz.requireProjectPermission(request, "execution_evidence.read", projectId);
    const artifact = await store.model("ExecutionArtifact").findOne({
      where: {
        execution_artifact_id: request.params.id,
        organization_id: actor.organizationId,
        project_id: actor.projectId,
        deleted_date: null,
      },
    });
    if (!artifact) return reply.code(404).send({ code: "EXECUTION_ARTIFACT_NOT_FOUND" });

    const base = String(process.env.STORAGE_SERVICE_URL || "http://127.0.0.1:8092").replace(/\/$/, "");
    const upstream = await axios.get(`${base}/storage/internal/files/${encodeURIComponent(artifact.storage_file_id)}/content`, {
      responseType: "stream",
      headers: { authorization: `Bearer ${getInternalApiToken()}` },
      timeout: 60_000,
    });
    reply.header("content-type", artifact.content_type || "application/octet-stream");
    reply.header("content-disposition", `attachment; filename="${safeFilename(artifact.filename)}"`);
    return reply.send(upstream.data);
  } catch (error) {
    return reply.code(error.statusCode || error.response?.status || 500).send({
      code: error.code || error.response?.data?.code || "ARTIFACT_DOWNLOAD_FAILED",
      message: error.message || "Artifact download failed",
    });
  }
}

function safeFilename(value) {
  return String(value || "artifact.bin").replace(/[\r\n"\\/]/g, "_").slice(0, 255);
}

module.exports = { artifactContent };
