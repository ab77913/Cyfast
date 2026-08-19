"use strict";

const config = require("../config.js");
const auditLogFactory = require("../database/" + config.db_type_secondary + "/factories/auditLogFactory");

const auditLogController = {
  getLogs: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const logs = await auditLogFactory.getByFilter(filters, sort, page, size);

    res.send(logs);
  },

  getLog: async (req, res) => {
    const id = req.params.id;

    const log = await auditLogFactory.getLogById(id);

    res.send(log);
  },

  createLog: async (req, res) => {
    const data = req.body;

    const log = await auditLogFactory.createLog(data);

    res.send(log);
  },
};

module.exports = auditLogController;
