"use strict";

const authz = require("../services/execution/execution-authz");
const service = require("../services/execution/execution-product-fix-service");

async function create(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.manage", projectId(request));
    return reply.code(201).send(await service.createProductFix(request.params.defectId, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function review(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.manage", projectId(request));
    return reply.send(await service.reviewProductFix(request.params.fixId, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function deployment(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.manage", projectId(request));
    return reply.send(await service.updateDeployment(request.params.fixId, request.body || {}, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function verification(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.manage", projectId(request));
    return reply.send(await service.linkVerificationRun(request.params.fixId, request.body?.execution_run_id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function list(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_defect.read", projectId(request));
    return reply.send(await service.listProductFixes(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

function projectId(request) {
  return request.body?.project_id || request.query?.project_id || request.headers["x-project-id"];
}

function fail(reply, error) {
  return reply.code(error.statusCode || 500).send({
    code: error.code || "PRODUCT_FIX_ERROR",
    message: error.message || "Product fix request failed",
  });
}

module.exports = { create, review, deployment, verification, list };
