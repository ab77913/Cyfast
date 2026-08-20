"use strict";

const axios = require("axios");
const lifecycle = require("../services/execution/execution-lifecycle-service");
const store = require("../services/execution/execution-store");
const authz = require("../services/execution/execution-authz");
const { validateTarget, redactSecrets, typedError } = require("../services/execution/execution-contract");
const { ensureExecutionPermissions } = require("../services/execution/execution-permission-bootstrap");
const { getInternalApiToken } = require("../services/windows/windows-security-config");

function fail(reply, error) {
  const status = Number(error.statusCode || error.response?.status || 500);
  return reply.code(status).send({
    code: error.code || error.response?.data?.code || "EXECUTION_ERROR",
    message: error.message || error.response?.data?.message || "Execution request failed",
    details: error.details || undefined,
  });
}

async function createTarget(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_target.manage", projectId(request));
    const validation = validateTarget(request.body);
    if (!validation.valid) throw typedError("INVALID_EXECUTION_TARGET", validation.errors.join(" | "), 422);
    return reply.code(201).send(await lifecycle.registerTarget({ ...request.body, platform: validation.platform }, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listTargets(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_target.read", projectId(request));
    return reply.send(await store.listTargets(actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function getTarget(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_target.read", projectId(request));
    const target = await store.getTarget(request.params.id, actor);
    return target ? reply.send(target) : reply.code(404).send({ code: "EXECUTION_TARGET_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function checkTarget(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_target.manage", projectId(request));
    return reply.send(await lifecycle.checkTarget(request.params.id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function revokeTarget(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_target.manage", projectId(request));
    const target = await store.revokeTarget(request.params.id, actor);
    return target ? reply.send(target) : reply.code(404).send({ code: "EXECUTION_TARGET_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function startRun(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.create", projectId(request));
    const idempotencyKey = request.headers["idempotency-key"] || request.body.idempotency_key;
    const run = await lifecycle.startRun({ ...request.body, idempotency_key: idempotencyKey }, actor);
    return reply.code(202).send(run);
  } catch (error) {
    return fail(reply, error);
  }
}

async function listRuns(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    return reply.send(await store.listRuns(actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function getRun(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    const run = await store.getRun(request.params.id, actor);
    return run ? reply.send(run) : reply.code(404).send({ code: "EXECUTION_RUN_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function cancelRun(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.cancel", projectId(request));
    return reply.send(await lifecycle.cancelRun(request.params.id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listEvents(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await store.listEvents(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listArtifacts(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_evidence.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await store.listArtifacts(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listRecordings(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_evidence.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await store.listRecordings(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function listDefects(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await store.listDefects(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function updateDefect(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.manage", projectId(request));
    const defect = await store.updateDefect(request.params.id, actor, request.body || {});
    return defect ? reply.send(defect) : reply.code(404).send({ code: "EXECUTION_DEFECT_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function listRepairs(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await store.listRepairAttempts(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function proposeRepair(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_repair.propose", projectId(request));
    return reply.code(201).send(await lifecycle.proposeRepair(request.params.id, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function approveRepairAndRerun(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_repair.approve", projectId(request));
    const idempotencyKey = request.headers["idempotency-key"] || request.body.idempotency_key;
    return reply.code(202).send(await lifecycle.approveRepairAndRerun(
      request.params.id,
      request.params.repairId,
      { ...request.body, idempotency_key: idempotencyKey },
      actor,
    ));
  } catch (error) {
    return fail(reply, error);
  }
}

async function ingestResult(request, reply) {
  try {
    const internal = authz.assertInternal(request);
    const actor = internalActor(request, internal);
    const result = await lifecycle.finalizeRun(request.params.id, redactSecrets(request.body || {}), actor);
    return reply.send(result);
  } catch (error) {
    return fail(reply, error);
  }
}

async function updateTargetHealthInternal(request, reply) {
  try {
    const internal = authz.assertInternal(request);
    const actor = internalActor(request, internal);
    const target = await store.updateTargetHealth(request.params.id, actor, request.body || {});
    return target ? reply.send(target) : reply.code(404).send({ code: "EXECUTION_TARGET_NOT_FOUND" });
  } catch (error) {
    return fail(reply, error);
  }
}

async function artifactContent(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_evidence.read", projectId(request));
    const artifact = await store.getArtifact(request.params.id, actor);
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
    return fail(reply, error);
  }
}

async function bootstrapPermissions(request, reply) {
  try {
    let organizationId;
    try {
      authz.assertInternal(request);
      organizationId = Number(request.body?.organization_id);
    } catch (_) {
      const actor = await authz.requirePermission(request, "execution_target.manage");
      organizationId = actor.organizationId;
    }
    if (!Number.isInteger(organizationId) || organizationId <= 0) throw typedError("INVALID_ORGANIZATION", "organization_id is required", 400);
    return reply.send(await ensureExecutionPermissions(organizationId, {
      assignToRoleName: request.body?.assignToRoleName || "Super Admin",
    }));
  } catch (error) {
    return fail(reply, error);
  }
}

async function requireRun(id, actor) {
  const run = await store.getRun(id, actor);
  if (!run) throw typedError("EXECUTION_RUN_NOT_FOUND", "Execution run was not found", 404);
  return run;
}

function projectId(request) {
  return request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
}

function internalActor(request, internal) {
  const organizationId = Number(request.body?.organization_id || request.headers["x-organization-id"]);
  const project = Number(request.body?.project_id || request.headers["x-project-id"]);
  if (!Number.isInteger(organizationId) || organizationId <= 0 || !Number.isInteger(project) || project <= 0) {
    throw typedError("INTERNAL_SCOPE_REQUIRED", "Internal execution updates require organization_id and project_id", 400);
  }
  return {
    organizationId,
    projectId: project,
    actorType: internal.actorType,
    actorId: internal.actorId,
  };
}

function safeFilename(value) {
  return String(value || "artifact.bin").replace(/[\r\n"\\/]/g, "_").slice(0, 255);
}

module.exports = {
  createTarget,
  listTargets,
  getTarget,
  checkTarget,
  revokeTarget,
  startRun,
  listRuns,
  getRun,
  cancelRun,
  listEvents,
  listArtifacts,
  listRecordings,
  listDefects,
  updateDefect,
  listRepairs,
  proposeRepair,
  approveRepairAndRerun,
  ingestResult,
  updateTargetHealthInternal,
  artifactContent,
  bootstrapPermissions,
};
