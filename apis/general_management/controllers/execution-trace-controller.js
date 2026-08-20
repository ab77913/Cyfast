"use strict";

const authz = require("../services/execution/execution-authz");
const store = require("../services/execution/execution-store");
const trace = require("../services/execution/execution-trace-service");
const { typedError } = require("../services/execution/execution-contract");

async function list(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await trace.listTraceLinks(request.params.id, actor, request.query));
  } catch (error) {
    return fail(reply, error);
  }
}

async function graph(request, reply) {
  try {
    const actor = await authz.requireProjectPermission(request, "execution_run.read", projectId(request));
    await requireRun(request.params.id, actor);
    return reply.send(await trace.buildTraceGraph(request.params.id, actor));
  } catch (error) {
    return fail(reply, error);
  }
}

async function appendInternal(request, reply) {
  try {
    const internal = authz.assertInternal(request);
    const actor = internalActor(request, internal);
    const run = await requireRun(request.params.id, actor);
    const links = Array.isArray(request.body?.links) ? request.body.links : [];
    if (!links.length) throw typedError("TRACE_LINKS_REQUIRED", "At least one trace link is required", 400);
    return reply.code(201).send({ items: await trace.appendTraceLinks(run, links, actor) });
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
  return request.query?.project_id || request.headers["x-project-id"] || request.body?.project_id;
}

function internalActor(request, internal) {
  const organizationId = Number(request.body?.organization_id || request.headers["x-organization-id"]);
  const project = Number(request.body?.project_id || request.headers["x-project-id"]);
  if (!Number.isInteger(organizationId) || organizationId <= 0 || !Number.isInteger(project) || project <= 0) {
    throw typedError("INTERNAL_SCOPE_REQUIRED", "Internal trace updates require organization_id and project_id", 400);
  }
  return { organizationId, projectId: project, actorType: internal.actorType, actorId: internal.actorId };
}

function fail(reply, error) {
  return reply.code(error.statusCode || 500).send({
    code: error.code || "TRACEABILITY_ERROR",
    message: error.message || "Traceability request failed",
  });
}

module.exports = { list, graph, appendInternal };
