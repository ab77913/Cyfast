"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const sql = require("mssql");
const dbConfig = {
  server: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  options: {
    encrypt: config.database_primary.sql_encrypt !== undefined ? config.database_primary.sql_encrypt : true,
  },
};

const getById = async (orchestrationExecutionId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrationExecutions");
    console.log("SQL - ", sqlQueries.executionById);
    const event = await pool.request().input("orchestrationExecutionId", sql.Int, orchestrationExecutionId).query(sqlQueries.executionById);

    return Array.isArray(event.recordset) && event.recordset.length > 0 ? event.recordset[0] : {};
  } catch (error) {
    return error.message;
  }
};

const getLatestByOrchestrationId = async (orchestrationId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrationExecutions");
    console.log("SQL - ", sqlQueries.latestExecutionByOrchestrationId);
    const event = await pool
      .request()
      .input("OrchestrationId", sql.Int, orchestrationId)
      .query(sqlQueries.latestExecutionByOrchestrationId);

    return Array.isArray(event.recordset) && event.recordset.length > 0 ? event.recordset[0] : {};
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getById,
  getLatestByOrchestrationId,
};
