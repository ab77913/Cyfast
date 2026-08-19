"use strict";

async function mainRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    return reply.send("Log Management");
  });
}

module.exports = mainRoutes;
