"use strict";

const config = require("../config.js");
const mq = require("../messaging/" + config.mq_type + "/index.js");
const consoleLogFactory = require("../database/" + config.db_type_secondary + "/factories/consoleLogFactory");

const consoleLogController = {
  getLogs: async (req, res) => {
    const { page, size, filters, sort } = req.query;
    const format = req.query.format || "merged";

    try {
      const consoleLogs = await consoleLogFactory.getByFilter(filters, sort, page, size);
      console.log(consoleLogs.pagination);
      let logs;
      if (consoleLogs && consoleLogs.data && consoleLogs.data.length > 0) {
        switch (format) {
          case "merged":
            let mergedLogs = { log_text: "" };
            consoleLogs.data.forEach((logItem) => {
              logItem.logs.forEach((log) => {
                let log_text = log.text ? log.text.replaceAll(/(?:\r\n|\r|\n)/g, "<br />") : "";
                mergedLogs.log_text =
                  mergedLogs.log_text +
                  "<div class='row'>" +
                  "<div class='col-sm-3 col-md-2'>" +
                  logItem.created_date +
                  "</div>" +
                  "<div class='col-sm-3 col-md-2'>" +
                  logItem.agent.name +
                  "</div>" +
                  "<div class='col-sm-6  col-md-8'>" +
                  log_text +
                  "</div></div>";
              });
            });
            logs = { data: mergedLogs };

            break;
          case "merged_agentwise":
            let mergedAgentWiseLogs = {};
            consoleLogs.data.forEach((logItem) => {
              if (mergedAgentWiseLogs[logItem.agent.name] == undefined) {
                mergedAgentWiseLogs[logItem.agent.name] = "";
              }
              logItem.logs.forEach((log) => {
                let log_text = log.text ? log.text.replaceAll(/(?:\r\n|\r|\n)/g, "<br />") : "";
                mergedAgentWiseLogs[logItem.agent.name] =
                  mergedAgentWiseLogs[logItem.agent.name] +
                  "<div class='row'>" +
                  "<div class='col-sm-3'>" +
                  logItem.created_date +
                  "</div>" +
                  "<div class='col-sm-3'>" +
                  logItem.agent.name +
                  "</div>" +
                  "<div class='col-sm-6'>" +
                  log_text +
                  "</div></div>";
              });
            });
            logs = { data: mergedAgentWiseLogs };

            break;
          case "separate":
            logs = consoleLogs;

            break;
          default:
            break;
        }
      }

      res.send(logs || consoleLogs);
    } catch (error) {
      console.log(error);
      res.send({ data: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 0 } });
    }
  },

  getLog: async (req, res) => {
    const id = req.params.id;

    const log = await consoleLogFactory.getLogById(id);

    res.send(log);
  },

  createLog: async (req, res) => {
    const data = req.body;

    const log = await consoleLogFactory.createLog(data);

    res.send(log);
  },

  publishLog: async (req, res) => {
    const data = req.body;

    //const log = await .createLog(data);
    const log = await mq.publishToQueue("console-log-download-queue", JSON.stringify(data));

    res.send(log);
  },
};

module.exports = consoleLogController;
