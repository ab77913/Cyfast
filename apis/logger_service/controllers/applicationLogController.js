"use strict";

const config = require("../config.js");
const applicationLogFactory = require("../database/" + config.db_type_secondary + "/factories/applicationLogFactory");

const applicationLogController = {
  getLogs: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const logs = await applicationLogFactory.getByFilter(filters, sort, page, size);

    res.send(logs);
  },

  getLog: async (req, res) => {
    const id = req.params.id;

    const log = await applicationLogFactory.getLogById(id);

    res.send(log);
  },

  createLog: async (req, res) => {
    const data = req.body;

    const log = await applicationLogFactory.createLog(data);

    res.send(log);
  },
};

module.exports = applicationLogController;
