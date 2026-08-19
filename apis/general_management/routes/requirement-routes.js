"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const requirementController = require("../controllers/requirement-controller");

async function requirementRoutes(fastify) {

  fastify.get("/", wrap(requirementController.getRequirements));
  fastify.post("/", wrap(requirementController.addRequirement));
  
  fastify.get("/:requirementId", wrap(requirementController.getRequirement));
  fastify.post("/:requirementId", wrap(requirementController.updateRequirement));
  fastify.delete("/:requirementId", wrap(requirementController.deleteRequirement));
}

module.exports = requirementRoutes;
