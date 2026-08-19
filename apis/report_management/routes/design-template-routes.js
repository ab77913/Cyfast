"use strict";

const { wrapExpressHandler: wrap } = require("../helpers/express-compat");
const { designTemplateUploadPreHandler } = require("../middlewares/fastify-design-template-upload");
const designTemplateController = require("../controllers/design-template-controller");

async function designTemplateRoutes(fastify) {
  fastify.get("/", wrap(designTemplateController.getDesignTemplates));
  fastify.post(
    "/",
    { preHandler: designTemplateUploadPreHandler },
    wrap(designTemplateController.addDesignTemplate),
  );

  fastify.get("/:designTemplateId", wrap(designTemplateController.getDesignTemplate));
  fastify.delete(
    "/:designTemplateId",
    wrap(designTemplateController.deleteDesignTemplate),
  );
}

module.exports = designTemplateRoutes;
