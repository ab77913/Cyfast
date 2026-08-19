"use strict";

const fastify = require("fastify")({ logger: true });
const config = require("./config.js");
const { buildOpenApiSpec } = require("./swagger/openapi-spec");

const mqConsumerConsoleLog = require("./messaging/" +
  config.mq_type +
  "/listenerConsoleLog.js");

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
  console.log(config.db_type_secondary + " Database not supported!");
  process.exit();
}

if (config.mq_type === "rabbitmq") {
  const mqUrl =
    "amqp://" +
    config.mq_config.host +
    ":" +
    config.mq_config.port +
    "?frameMax=0";
  console.log("RabbitMQ URL-", mqUrl);

  mqConsumerConsoleLog.listenToExchange(mqUrl, "console_log_exchange");

  console.log("RabbitMQ connected!");
} else {
  console.log("Messaging Service not supported!");
  process.exit();
}

const mainRoutes = require("./routes/mainRoutes");
const applicationLogRoutes = require("./routes/applicationLogRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const consoleLogRoutes = require("./routes/consoleLogRoutes");
const executionLogRoutes = require("./routes/executionLogRoutes");

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

  await fastify.register(mainRoutes, { prefix: "/logs" });
  await fastify.register(applicationLogRoutes, { prefix: "/logs/application" });
  await fastify.register(activityLogRoutes, { prefix: "/logs/activity" });
  await fastify.register(auditLogRoutes, { prefix: "/logs/audit" });
  await fastify.register(consoleLogRoutes, { prefix: "/logs/console" });
  await fastify.register(executionLogRoutes, { prefix: "/logs/execution" });
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
