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

const getExecutionSummaryByProjectId = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const event = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.executionSummaryByProjectId);
    return event.recordset;
  } catch (error) {
    return error.message;
  }
};

const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const event = await pool
      .request()
      .input("orchestrationId", sql.Int, orchestrationId)
      .query(sqlQueries.executionSummaryByOrchestrationId);
    return event.recordset;
  } catch (error) {
    return error.message;
  }
};

const getExecutionLogsByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const event = await pool
      .request()
      .input("orchestrationExecutionId", sql.VarChar(50), orchestrationExecutionId)
      .query(sqlQueries.executionLogsByOrchestrationExecutionId);
    return event.recordset;
  } catch (error) {
    return error.message;
  }
};

const getExecutionResultStatisticsByOrchestrationExecutionId = async (orchestrationExecutionId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const event = await pool
      .request()
      .input("orchestrationExecutionId", sql.VarChar(50), orchestrationExecutionId)
      .query(sqlQueries.executionResultStatisticsByOrchestrationExecutionId);
    return Array.isArray(event.recordset) && event.recordset.length > 0 ? event.recordset[0] : {};
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getExecutionSummaryByProjectId,
  getExecutionSummaryByOrchestrationId,
  getExecutionLogsByOrchestrationExecutionId,
  getExecutionResultStatisticsByOrchestrationExecutionId,
};
