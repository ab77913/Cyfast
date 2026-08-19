"use strict";

const config = require("../config.js");
const activityLogFactory = require("../database/" + config.db_type_secondary + "/factories/activityLogFactory");

const activityLogController = {
  getLogs: async (req, res) => {
    const { page, size, filters, sort } = req.query;

    const logs = await activityLogFactory.getByFilter(filters, sort, page, size);

    res.send(logs);
  },

  getLog: async (req, res) => {
    const id = req.params.id;

    const log = await activityLogFactory.getLogById(id);

    res.send(log);
  },

  createLog: async (req, res) => {
    const data = req.body;
    if (data.server === undefined || data.server === null || data.server === "") {
      delete data["server"];
    }
    //console.log("activity log", data);
    const log = await activityLogFactory.createLog(data);

    res.send(log);
  },
};

module.exports = activityLogController;
