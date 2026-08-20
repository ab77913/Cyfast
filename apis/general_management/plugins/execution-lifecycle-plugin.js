"use strict";

const crypto = require("crypto");
const executionLifecycleRoutes = require("../routes/execution-lifecycle-routes");
const {
  ExecutionLifecycleOrchestrator,
} = require("../services/execution_lifecycle/execution-orchestrator");
const {
  PlatformAdapterRegistry,
} = require("../services/execution_lifecycle/platform-adapter-registry");
const {
  createHttpAgentFactory,
} = require("../services/execution_lifecycle/http-agent-platform-adapter");
const {
  StorageServiceArtifactStore,
} = require("../services/execution_lifecycle/storage-service-artifact-store");
const {
  ExecutionLifecycleRepository,
} = require("../database/mysql/repositories/execution-lifecycle-repository");

function findSequelize(value, seen = new Set(), depth = 0) {
  if (!value || depth > 3 || seen.has(value)) return null;
  seen.add(value);
  if (typeof value.query === "function" && typeof value.transaction === "function") return value;
  if (typeof value !== "object") return null;
  for (const key of ["sequelize", "connection", "db", "mysql", "models", "default"]) {
    const found = findSequelize(value[key], seen, depth + 1);
    if (found) return found;
  }
  return null;
}

function loadExistingDatabaseModule() {
  for (const path of [
    "../database/mysql/models",
    "../database/mysql",
    "../database",
  ]) {
    try {
      return require(path);
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  return null;
}

function resolveSequelize(fastify, options) {
  return findSequelize(options.sequelize) ||
    findSequelize(options.database) ||
    findSequelize(fastify.sequelize) ||
    findSequelize(fastify.mysql) ||
    findSequelize(fastify.db) ||
    findSequelize(loadExistingDatabaseModule());
}

function defaultCredentialResolver(reference) {
  const value = String(reference || "").trim();
  if (!value) return null;
  if (value.startsWith("env:")) {
    const name = value.slice(4);
    if (!/^[A-Z_][A-Z0-9_]{0,127}$/i.test(name)) return null;
    return process.env[name] || null;
  }
  const normalized = value.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
  return process.env[`CYFAST_SECRET_${normalized}`] || null;
}

function decorateOnce(fastify, name, value) {
  if (typeof fastify.hasDecorator === "function" && fastify.hasDecorator(name)) return;
  fastify.decorate(name, value);
}

async function executionLifecyclePlugin(fastify, options = {}) {
  const sequelize = resolveSequelize(fastify, options);
  const repository = options.repository || (sequelize
    ? new ExecutionLifecycleRepository({ sequelize, clock: options.clock })
    : null);
  if (!repository) {
    const error = new Error(
      "Execution lifecycle persistence requires the existing General Management Sequelize connection.",
    );
    error.code = "EXECUTION_DATABASE_UNAVAILABLE";
    throw error;
  }

  const credentialResolver = options.credentialResolver ||
    fastify.credentialResolver ||
    defaultCredentialResolver;
  const adapterRegistry = options.adapterRegistry || new PlatformAdapterRegistry();
  if (options.registerDefaultHttpAgent !== false) {
    adapterRegistry.register({
      platform: "*",
      capabilities: ["HTTP_AGENT"],
      priority: 100,
      name: "first-party-http-agent",
    }, createHttpAgentFactory({
      credentialResolver,
      fetchImpl: options.fetchImpl || globalThis.fetch,
    }));
  }
  for (const registration of options.adapters || []) {
    adapterRegistry.register(registration, registration.factory);
  }

  const artifactStore = options.artifactStore || new StorageServiceArtifactStore({
    repository,
    serviceUrl: options.storageServiceUrl,
    uploadEndpoint: options.storageUploadEndpoint,
    credentialRef: options.storageCredentialRef,
    credentialResolver,
    fetchImpl: options.fetchImpl || globalThis.fetch,
    clock: options.clock,
    idGenerator: options.idGenerator,
  });

  const baseDefectService = options.defectService || fastify.defectService || null;
  const defectService = baseDefectService && typeof baseDefectService.create === "function"
    ? {
        async create(input) {
          const defect = await baseDefectService.create(input);
          if (defect && typeof repository.linkDefect === "function") {
            await repository.linkDefect({
              id: crypto.randomUUID(),
              executionId: input.executionId,
              attemptNumber: input.attemptNumber,
              organizationId: input.organizationId,
              projectId: input.projectId,
              defectId: defect.id || defect.defectId,
              failureClassification: input.classification,
              createdAt: new Date(),
            });
          }
          return defect;
        },
      }
    : null;

  const orchestrator = options.orchestrator || new ExecutionLifecycleOrchestrator({
    repository,
    adapterRegistry,
    artifactStore,
    defectService,
    repairEngine: options.repairEngine || fastify.automationRepairEngine || null,
    eventPublisher: options.eventPublisher || fastify.executionEventPublisher || null,
    clock: options.clock,
    idGenerator: options.idGenerator,
    maxRepairAttempts: options.maxRepairAttempts,
    runtimeProofMaximumAgeMs: options.runtimeProofMaximumAgeMs,
    requiredArtifactTypes: options.requiredArtifactTypes || {
      WINDOWS: ["ROBOT_OUTPUT_XML"],
      WINDOWS_DESKTOP: ["ROBOT_OUTPUT_XML"],
      ANDROID: ["ROBOT_OUTPUT_XML"],
      LINUX_DESKTOP: ["ROBOT_OUTPUT_XML"],
    },
  });

  decorateOnce(fastify, "executionLifecycleRepository", repository);
  decorateOnce(fastify, "executionPlatformAdapterRegistry", adapterRegistry);
  decorateOnce(fastify, "executionArtifactStore", artifactStore);
  decorateOnce(fastify, "executionLifecycleOrchestrator", orchestrator);

  await fastify.register(executionLifecycleRoutes, {
    repository,
    orchestrator,
    artifactStore,
  });

  fastify.addHook("onReady", async () => {
    setImmediate(() => {
      orchestrator.recoverInterruptedExecutions().catch((error) => {
        fastify.log.error({
          err: error,
          code: error?.code || "EXECUTION_RECOVERY_FAILED",
        }, "Execution lifecycle restart recovery failed");
      });
    });
  });
}

module.exports = executionLifecyclePlugin;
module.exports.defaultCredentialResolver = defaultCredentialResolver;
module.exports.findSequelize = findSequelize;
module.exports.resolveSequelize = resolveSequelize;
