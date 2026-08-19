"use strict";

const fs = require("fs");
const config = require("../config.js");
const designTemplateFactory = require(
  "../database/" +
    config.db_type_secondary +
    "/factories/design-template-factory",
);

const designTemplateController = {
  getDesignTemplates: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const designTemplates = await designTemplateFactory.getByFilter(
      filters,
      sort,
      page,
      size,
    );

    res.send(designTemplates);
  },

  getDesignTemplate: async (req, res) => {
    const designTemplateId = req.params.designTemplateId;

    const designTemplate =
      await designTemplateFactory.getById(designTemplateId);

    res.send(designTemplate);
  },

  addDesignTemplate: async (req, res) => {
    try {
      if (req.file == undefined) {
        return res.status(400).send({
          message: "Error occured while uploading file, Please upload a file!",
        });
      }
      const data = req.body;
      data.filepath = req.file.path;
      data.filename = req.file.filename;
      data.originalname = req.file.originalname;
      data.mimetype = req.file.mimetype;

      const designTemplate = await designTemplateFactory.create(data);

      res.send(designTemplate);
    } catch (error) {
      fs.unlinkSync(req.file.path);

      res.status(500).send({
        message: `Error occured while uploading file: ${error}`,
      });
    }
  },

  deleteDesignTemplate: async (req, res) => {
    const designTemplateId = req.params.designTemplateId;

    const designTemplate = await designTemplateFactory.remove(designTemplateId);

    res.send(designTemplate);
  },
};

module.exports = designTemplateController;
