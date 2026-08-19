"use strict";

const utils = require("../utils");
// Fetch execution stats for a project
const getExecutionStats = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not available.");
    }
    const sqlQueries = await utils.loadSqlQueries("requirements");
    const [rows] = await pool.query(sqlQueries.executionStats, [projectId]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch most failed stats for a project
const getMostFailed = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not available.");
    }
    const sqlQueries = await utils.loadSqlQueries("requirements");
    const [rows] = await pool.query(sqlQueries.mostFailed, [
      projectId,
      projectId,
    ]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getExecutionStats,
  getMostFailed,
};
