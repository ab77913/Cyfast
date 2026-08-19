"use strict";

const fastify = require("fastify")({ logger: true });
const httpProxy = require("@fastify/http-proxy");
const config = require("./config");

async function buildApp() {
  await fastify.register(require("@fastify/cors"), {
    origin: true,
    credentials: true,
  });

  fastify.get("/", async () => ({
    service: "cyfast-api-gateway",
    env: config.env,
    listen: { host: config.host, port: config.port },
    routes: config.proxies.map((p) => ({
      name: p.name,
      gatewayPrefix: p.prefix,
      example: `${config.publicUrl}${p.prefix}/…`,
      upstream: config.upstreamUrl(p.upstreamKey),
    })),
  }));

  fastify.get("/health", async () => ({ status: "ok" }));

  for (const route of config.proxies) {
    const upstream = config.upstreamUrl(route.upstreamKey);
    await fastify.register(httpProxy, {
      upstream,
      prefix: route.prefix,
      http2: false,
    });
    fastify.log.info(
      { prefix: route.prefix, upstream, name: route.name },
      "registered proxy",
    );
  }
}

async function start() {
  await buildApp();
  await fastify.listen({ port: config.port, host: config.host });
  fastify.log.info(
    `CyFAST API gateway listening on ${config.host}:${config.port} (${config.publicUrl})`,
  );
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
