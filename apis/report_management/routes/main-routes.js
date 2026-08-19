"use strict";

async function mainRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    return reply.send("Report Management");
  });
}

module.exports = mainRoutes;
