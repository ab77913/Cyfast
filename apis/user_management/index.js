"use strict";
const fastify = require("fastify")({ logger: true });
const config = require("./config");
const { buildOpenApiDoc } = require("./swagger/openapi-config");

const mainRoutes = require("./routes/main-routes");
const authRoutes = require("./routes/auth-routes");
const userRoutes = require("./routes/user-routes");
const roleRoutes = require("./routes/role-routes");
const permissionRoutes = require("./routes/permission-routes");

async function buildApp() {
  await fastify.register(require("@fastify/swagger"), {
    openapi: buildOpenApiDoc(config),
  });
  await fastify.register(require("@fastify/swagger-ui"), {
    routePrefix: "/api-docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
    staticCSP: true,
  });

  await fastify.register(require("@fastify/cors"), { origin: "*" });

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
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(userRoutes, { prefix: "/users" });
  await fastify.register(roleRoutes, { prefix: "/roles" });
  await fastify.register(permissionRoutes, { prefix: "/permissions" });
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
