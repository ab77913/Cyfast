"use strict";

async function mainRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    return reply.send("General Management");
  });
}

module.exports = mainRoutes;
