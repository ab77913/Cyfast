"use strict";

async function mainRoutes(fastify) {
  fastify.get("/", async (request, reply) => {
    return reply.send("User, Role & Permission Management");
  });
}

module.exports = mainRoutes;
