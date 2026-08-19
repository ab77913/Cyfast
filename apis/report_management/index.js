"use strict";

const fastify = require("fastify")({ logger: true });
const config = require("./config");
const { buildOpenApiSpec } = require("./swagger/openapi-spec");

const bootService = require("./services/boot-service");

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

  setTimeout(() => {
    bootService
      .setupDefault()
      .then(() => {
        console.log("Default report templates setup completed.");
      })
      .catch((error) => {
        console.error("Error setting up default report templates:", error);
      });
  }, 3000);
  console.log("Elasticsearch URL-", client.nodeUrl);
} else {
  console.log("Secondary Database not supported!");
}

const mainRoutes = require("./routes/main-routes");
const designTemplateRoutes = require("./routes/design-template-routes");
const reportSectionRoutes = require("./routes/report-section-routes");
const reportTemplateRoutes = require("./routes/report-template-routes");
const reportRoutes = require("./routes/report-routes");

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

  await fastify.register(mainRoutes, { prefix: "/" });
  await fastify.register(designTemplateRoutes, { prefix: "/design_templates" });
  await fastify.register(reportSectionRoutes, { prefix: "/report_sections" });
  await fastify.register(reportTemplateRoutes, { prefix: "/report_templates" });
  await fastify.register(reportRoutes, { prefix: "/reports" });
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
