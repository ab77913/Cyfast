"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const mysql = require("mysql2/promise");

const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl:
    config.database_primary.sql_encrypt !== undefined
      ? { rejectUnauthorized: true } // Use SSL if encryption is defined
      : null, // No SSL if encryption is not defined
};

const getExecutionSummaryByProjectId = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const [rows] = await pool.execute(sqlQueries.executionSummaryByProjectId, [
      projectId,
    ]);

    return rows;
  } catch (error) {
    return error.message;
  }
};

const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const [rows] = await pool.execute(
      sqlQueries.executionSummaryByOrchestrationId,
      [orchestrationId]
    );

    return rows;
  } catch (error) {
    return error.message;
  }
};

const getExecutionLogsByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const [rows] = await pool.execute(
      sqlQueries.executionLogsByOrchestrationExecutionId,
      [orchestrationExecutionId]
    );

    return rows;
  } catch (error) {
    return error.message;
  }
};

const getExecutionResultStatisticsByOrchestrationExecutionId = async (
  orchestrationExecutionId
) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testExecutions");
    const [rows] = await pool.execute(
      sqlQueries.executionResultStatisticsByOrchestrationExecutionId,
      [orchestrationExecutionId]
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
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
