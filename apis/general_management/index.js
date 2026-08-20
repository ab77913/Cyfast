"use strict";

const qs = require("qs");
const fastify = require("fastify")({
  logger: true,
  querystringParser: (str) =>
    qs.parse(str, { allowPrototypes: false, depth: 10, parameterLimit: 200 }),
});
const config = require("./config");
const aiEngineClient = require("./services/ai-engine-client.js");

const aiEngineBase = aiEngineClient.baseUrl();
if (aiEngineBase) {
  console.log("AI engine (RAG/chat):", aiEngineBase);
} else {
  console.log(
    "AI_ENGINE_URL is not set — document chat/search use the embedded Node RAG only."
  );
  console.log(
    "Requirement generation/regenerate and generation_validation still call the Python ai_engine; set AI_ENGINE_URL (e.g. http://127.0.0.1:8099) or those routes will fail."
  );
}

const { buildOpenApiSpec } = require("./swagger/openapi-spec");

const backgroundService = require("./services/background-service.js");
const mqProducer = require("./messaging/" + config.mq_type + "/mq-producer.js");
const listenerParser = require(
  "./messaging/" + config.mq_type + "/listener-parser.js",
);
const listenerAgentRegistration = require(
  "./messaging/" + config.mq_type + "/listener-test-agent-registration.js",
);
const listenerAgentHeartbeat = require(
  "./messaging/" + config.mq_type + "/listener-test-agent-heartbeat.js",
);
const listenerProjectUpdate = require(
  "./messaging/" + config.mq_type + "/listener-project-update.js",
);
const listenerTestCaseExecution = require(
  "./messaging/" + config.mq_type + "/listener-test-case-execution.js",
);
const listenerOrchestrationStatus = require(
  "./messaging/" + config.mq_type + "/listener-orchestration-status.js",
);
const listenerRequirementGeneration = require(
  "./messaging/" + config.mq_type + "/listener-requirement-generation.js",
);
const listenerTestScenarioGeneration = require(
  "./messaging/" + config.mq_type + "/listener-test-scenario-generation.js",
);
const listenerTestCaseGeneration = require(
  "./messaging/" + config.mq_type + "/listener-test-case-generation.js",
);
const windowsOutboxPublisher = require("./services/windows/windows-outbox-publisher");

if (config.db_type_secondary === "mongodb") {
  const db = require("./database/mongodb/models");
  console.log("MongoDB URL-", db.url);

  db.mongoose
    .connect(db.url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Connected to the Mongo database!");
    })
    .catch((err) => {
      console.log("Cannot connect to the Mongo database!", err);
      process.exit();
    });
} else if (config.db_type_secondary === "elasticsearch") {
  const client = require("./database/elasticsearch/models");
  console.log("Elasticsearch URL-", client.nodeUrl);
} else {
  console.log("Secondary Database not supported!");
}

if (config.mq_type === "rabbitmq") {
  const mqUrl =
    "amqp://" +
    config.mq_config.host +
    ":" +
    config.mq_config.port +
    "?frameMax=0";
  console.log("RabbitMQ URL-", mqUrl);

  mqProducer.testConnection(mqUrl);

  listenerAgentRegistration.listenToExchange(
    mqUrl,
    config.mq_exchanges.agent_registration_response,
  );
  listenerAgentHeartbeat.listenToExchange(
    mqUrl,
    config.mq_exchanges.agent_heartbeat_response,
  );

  listenerParser.listenToQueue(mqUrl, config.mq_queues.parser_response);

  listenerTestCaseExecution.listenToExchange(
    mqUrl,
    config.mq_exchanges.execution_testcase,
  );
  listenerOrchestrationStatus.listenToQueue(
    mqUrl,
    config.mq_queues.execution_status_response,
  );

  listenerRequirementGeneration.listenToQueue(
    mqUrl,
    config.mq_queues.requirement_generation_request,
  );
  listenerTestScenarioGeneration.listenToQueue(
    mqUrl,
    config.mq_queues.test_scenario_generation_request,
  );
  listenerTestCaseGeneration.listenToQueue(
    mqUrl,
    config.mq_queues.test_case_generation_request,
  );

  setInterval(backgroundService.monitorTestAgents, 10000);
  setInterval(() => {
    windowsOutboxPublisher.publishPending().catch((error) =>
      fastify.log.error(error, "Windows outbox publish failed"),
    );
  }, 5000);
} else {
  console.log("Messaging Service not supported!");
  process.exit();
}

const mainRoutes = require("./routes/main-routes");
const dashboardRoutes = require("./routes/dashboard-routes");
const projectRoutes = require("./routes/project-routes");
const orchestrationRoutes = require("./routes/orchestration-routes");
const traceabilityRoutes = require("./routes/traceability-routes");
const requirementRoutes = require("./routes/requirement-routes");
const riskRoutes = require("./routes/risk-routes");
const testSourceRoutes = require("./routes/test-source-routes");
const testSuiteRoutes = require("./routes/test-suite-routes");
const testCaseRoutes = require("./routes/test-case-routes");
const testScriptRoutes = require("./routes/test-script-routes");
const testAgentRoutes = require("./routes/test-agent-routes");
const projectDocumentRoutes = require("./routes/project-document-routes");
const requirementGenerationRoutes = require("./routes/requirement-generation-routes");
const testScenarioGenerationRoutes = require("./routes/test-scenario-generation-routes");
const testScenarioRoutes = require("./routes/test-scenario-routes");
const generationValidationRoutes = require("./routes/generation-validation-routes");
const userNotificationRoutes = require("./routes/user-notification-routes");
const windowsRoutes = require("./routes/windows-routes");
const executionLifecyclePlugin = require("./plugins/execution-lifecycle-plugin");

async function buildApp() {
  await fastify.register(require("@fastify/swagger"), {
    openapi: buildOpenApiSpec(config),
  });
  await fastify.register(require("@fastify/swagger-ui"), {
    routePrefix: "/api-docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
    staticCSP: true,
  });

  await fastify.register(require("@fastify/cors"), { origin: "*" });

  // CYFAST_EXECUTION_LIFECYCLE_REGISTERED
  // Keep execution persistence, authenticated APIs, SSE replay, adapter
  // selection, and restart reconciliation in the existing service lifecycle.
  await fastify.register(executionLifecyclePlugin);

  await fastify.register(require("@fastify/formbody"), {
    bodyLimit: config.max_post_size_bytes,
  });

  await fastify.register(require("@fastify/multipart"), {
    limits: { fileSize: config.max_post_size_bytes },
  });

  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: config.max_post_size_bytes },
    function (req, body, done) {
      try {
        const json = JSON.parse(body);
        done(null, json);
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  await fastify.register(mainRoutes, { prefix: "/" });
  await fastify.register(dashboardRoutes, { prefix: "/dashboard" });
  await fastify.register(projectRoutes, { prefix: "/projects" });
  await fastify.register(orchestrationRoutes, { prefix: "/orchestrations" });
  await fastify.register(traceabilityRoutes, { prefix: "/traceability" });
  await fastify.register(requirementRoutes, { prefix: "/requirements" });
  await fastify.register(requirementGenerationRoutes, {
    prefix: "/requirement_generation",
  });
  await fastify.register(testScenarioGenerationRoutes, {
    prefix: "/test_scenario_generation",
  });
  await fastify.register(generationValidationRoutes, {
    prefix: "/generation_validation",
  });
  await fastify.register(userNotificationRoutes, {
    prefix: "/user_notifications",
  });
  await fastify.register(riskRoutes, { prefix: "/risks" });
  await fastify.register(testSourceRoutes, { prefix: "/test_sources" });
  await fastify.register(testSuiteRoutes, { prefix: "/test_suites" });
  await fastify.register(testScriptRoutes, { prefix: "/test_scripts" });
  await fastify.register(testCaseRoutes, { prefix: "/test_cases" });
  await fastify.register(testScenarioRoutes, { prefix: "/test_scenarios" });
  await fastify.register(testAgentRoutes, { prefix: "/test_agents" });
  await fastify.register(projectDocumentRoutes, { prefix: "/project_documents" });
  await fastify.register(windowsRoutes, { prefix: "/" });
}

async function start() {
  try {
    await buildApp();
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    console.log("app listening on url " + config.url);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
