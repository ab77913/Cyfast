"use strict";
const utils = require("../utils");

const getExecutionSummaryByProjectId = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-case-executions");
    const [rows] = await pool.query(sqlQueries.executionSummaryByProjectId, [
      projectId,
      projectId,
    ]);

    return rows;
  } catch (error) {
    return error.message;
  }
};

const getExecutionSummaryByOrchestrationId = async (orchestrationId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-case-executions");
    const [rows] = await pool.query(
      sqlQueries.getExecutionSummaryByOrchestrationId,
      [orchestrationId, orchestrationId]
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
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-case-executions");
    const [rows] = await pool.query(
      sqlQueries.executionResultStatisticsByOrchestrationExecutionId,
      [orchestrationExecutionId]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getExecutionSummaryByProjectId,
  getExecutionSummaryByOrchestrationId,
  getExecutionResultStatisticsByOrchestrationExecutionId,
};
