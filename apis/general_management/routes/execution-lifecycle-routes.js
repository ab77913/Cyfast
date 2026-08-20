"use strict";

const { isTerminal } = require("../services/execution_lifecycle/execution-state-machine");
const {
  ExecutionScopeError,
  resolveExecutionScope,
} = require("../services/execution_lifecycle/execution-scope");

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(number), maximum));
}

function errorStatus(error) {
  if (Number.isInteger(error?.statusCode)) return error.statusCode;
  if (error?.code === "EXECUTION_NOT_FOUND" || error?.code === "ARTIFACT_NOT_FOUND") return 404;
  if (error?.code === "EXECUTION_VERSION_CONFLICT") return 409;
  if (String(error?.code || "").includes("VALIDATION") ||
      String(error?.code || "").includes("REQUIRED") ||
      String(error?.code || "").includes("INVALID")) return 400;
  if (String(error?.code || "").includes("FORBIDDEN")) return 403;
  if (String(error?.code || "").includes("UNAUTH")) return 401;
  return 500;
}

function sendError(reply, error) {
  const statusCode = errorStatus(error);
  return reply.code(statusCode).send({
    error: {
      code: error?.code || "INTERNAL_ERROR",
      message: statusCode >= 500 ? "Execution service request failed." : error.message,
      ...(statusCode < 500 && error?.details ? { details: error.details } : {}),
    },
  });
}

async function requireExecution(repository, executionId, scope) {
  const execution = await repository.getExecution(executionId, scope);
  if (!execution) {
    const error = new Error("Execution was not found in this project.");
    error.code = "EXECUTION_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  return execution;
}

async function executionLifecycleRoutes(fastify, options = {}) {
  const repository = options.repository || fastify.executionLifecycleRepository;
  const orchestrator = options.orchestrator || fastify.executionLifecycleOrchestrator;
  const artifactStore = options.artifactStore || fastify.executionArtifactStore;
  if (!repository || !orchestrator || !artifactStore) {
    throw new Error("Execution lifecycle plugin dependencies are not registered.");
  }

  fastify.post("/v1/executions", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "idempotencyKey", "package", "target"],
        properties: {
          organizationId: { type: "string", minLength: 1, maxLength: 128 },
          projectId: { type: "string", minLength: 1, maxLength: 128 },
          platform: { type: "string", minLength: 1, maxLength: 64 },
          idempotencyKey: { type: "string", minLength: 1, maxLength: 256 },
          correlationId: { type: "string", minLength: 1, maxLength: 128 },
          requirementId: { type: ["string", "null"], maxLength: 128 },
          scenarioId: { type: ["string", "null"], maxLength: 128 },
          testCaseId: { type: ["string", "null"], maxLength: 128 },
          testScriptId: { type: ["string", "null"], maxLength: 128 },
          package: { type: "object", additionalProperties: true },
          target: { type: "object", additionalProperties: true },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        const execution = await orchestrator.start({
          ...request.body,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
        }, scope);
        return reply.code(202).send({ execution });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.get("/v1/executions", {
    schema: {
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
          status: { type: "string", maxLength: 64 },
          platform: { type: "string", maxLength: 64 },
          page: { type: "integer", minimum: 1, maximum: 1000000 },
          pageSize: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        const result = await repository.listExecutions({
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          status: request.query?.status,
          platform: request.query?.platform,
          page: boundedInteger(request.query?.page, 1, 1, 1000000),
          pageSize: boundedInteger(request.query?.pageSize, 25, 1, 100),
        });
        return reply.send(result);
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.get("/v1/executions/:executionId", {
    schema: {
      params: {
        type: "object",
        required: ["executionId"],
        properties: { executionId: { type: "string", minLength: 1, maxLength: 128 } },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        const execution = await requireExecution(
          repository,
          request.params.executionId,
          scope,
        );
        const [events, artifacts] = await Promise.all([
          repository.listEvents({
            ...scope,
            executionId: execution.id,
            afterSequence: 0,
            limit: 1000,
          }),
          repository.listArtifacts({
            ...scope,
            executionId: execution.id,
          }),
        ]);
        return reply.send({ execution, events, artifacts });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.post("/v1/executions/:executionId/cancel", {
    schema: {
      params: {
        type: "object",
        required: ["executionId"],
        properties: { executionId: { type: "string", minLength: 1, maxLength: 128 } },
      },
      body: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        await requireExecution(repository, request.params.executionId, scope);
        const execution = await orchestrator.requestCancellation(
          request.params.executionId,
          scope,
        );
        return reply.code(202).send({ execution });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.get("/v1/executions/:executionId/events", {
    schema: {
      params: {
        type: "object",
        required: ["executionId"],
        properties: { executionId: { type: "string", minLength: 1, maxLength: 128 } },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
          afterSequence: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 1000 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        await requireExecution(repository, request.params.executionId, scope);
        const events = await repository.listEvents({
          ...scope,
          executionId: request.params.executionId,
          afterSequence: boundedInteger(request.query?.afterSequence, 0, 0, Number.MAX_SAFE_INTEGER),
          limit: boundedInteger(request.query?.limit, 200, 1, 1000),
        });
        return reply.send({ events });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.get("/v1/executions/:executionId/events/stream", {
    schema: {
      params: {
        type: "object",
        required: ["executionId"],
        properties: { executionId: { type: "string", minLength: 1, maxLength: 128 } },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
          afterSequence: { type: "integer", minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      let scope;
      let execution;
      try {
        scope = resolveExecutionScope(request);
        execution = await requireExecution(repository, request.params.executionId, scope);
      } catch (error) {
        return sendError(reply, error);
      }

      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      let closed = false;
      let afterSequence = boundedInteger(
        request.headers?.["last-event-id"] || request.query?.afterSequence,
        0,
        0,
        Number.MAX_SAFE_INTEGER,
      );
      let lastHeartbeat = Date.now();
      request.raw.on("close", () => { closed = true; });

      try {
        while (!closed) {
          const events = await repository.listEvents({
            ...scope,
            executionId: execution.id,
            afterSequence,
            limit: 200,
          });
          for (const event of events) {
            if (closed) break;
            afterSequence = Math.max(afterSequence, event.sequence);
            reply.raw.write(`id: ${event.sequence}\n`);
            reply.raw.write(`event: ${event.type}\n`);
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
          }
          execution = await requireExecution(repository, execution.id, scope);
          if (isTerminal(execution.status) && events.length === 0) {
            reply.raw.write(`event: execution-complete\n`);
            reply.raw.write(`data: ${JSON.stringify({
              executionId: execution.id,
              status: execution.status,
            })}\n\n`);
            break;
          }
          if (Date.now() - lastHeartbeat >= 15000) {
            reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
            lastHeartbeat = Date.now();
          }
          await delay(1000);
        }
      } catch (error) {
        if (!closed) {
          reply.raw.write("event: stream-error\n");
          reply.raw.write(`data: ${JSON.stringify({
            code: error?.code || "EVENT_STREAM_FAILED",
            message: "Execution event stream failed.",
          })}\n\n`);
        }
      } finally {
        if (!closed) reply.raw.end();
      }
    },
  });

  fastify.get("/v1/executions/:executionId/artifacts", {
    schema: {
      params: {
        type: "object",
        required: ["executionId"],
        properties: { executionId: { type: "string", minLength: 1, maxLength: 128 } },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
          attemptNumber: { type: "integer", minimum: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        await requireExecution(repository, request.params.executionId, scope);
        const artifacts = await repository.listArtifacts({
          ...scope,
          executionId: request.params.executionId,
          attemptNumber: request.query?.attemptNumber,
        });
        return reply.send({ artifacts });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });

  fastify.get("/v1/executions/:executionId/artifacts/:artifactId/download", {
    schema: {
      params: {
        type: "object",
        required: ["executionId", "artifactId"],
        properties: {
          executionId: { type: "string", minLength: 1, maxLength: 128 },
          artifactId: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          organizationId: { type: "string", maxLength: 128 },
          projectId: { type: "string", maxLength: 128 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const scope = resolveExecutionScope(request);
        await requireExecution(repository, request.params.executionId, scope);
        const reference = await artifactStore.getDownloadReference({
          artifactId: request.params.artifactId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
        });
        const artifact = await repository.getArtifact(request.params.artifactId, scope);
        if (!artifact || artifact.executionId !== request.params.executionId) {
          throw new ExecutionScopeError(
            "ARTIFACT_EXECUTION_SCOPE_FORBIDDEN",
            "Artifact does not belong to this execution.",
            403,
          );
        }
        return reply.send({ artifact: reference });
      } catch (error) {
        return sendError(reply, error);
      }
    },
  });
}

module.exports = executionLifecycleRoutes;
module.exports.sendError = sendError;
module.exports.requireExecution = requireExecution;
