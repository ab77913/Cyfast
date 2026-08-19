"use strict";

const utils = require("../utils");

// Fetch execution stats by project ID and orchestration ID
const getExecutionStats = async (projectId, orchestrationId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-scripts");
    const [rows] = await pool.query(sqlQueries.executionStats, [
      projectId,
      orchestrationId,
    ]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch most failed test scripts by project ID
const getMostFailed = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-scripts");
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

// Fetch test script by project ID and test script name
const getByProjectIdAndTestScriptName = async (projectId, testScriptName) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-scripts");
    const [rows] = await pool.query(
      sqlQueries.testScriptByProjectIdAndTestScriptName,
      [projectId, testScriptName]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch test script by project ID and test script file path
const getByProjectIdAndTestScriptFilePath = async (
  projectId,
  testScriptFilePath
) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-scripts");
    const [rows] = await pool.query(
      sqlQueries.testScriptByProjectIdAndTestScriptFilePath,
      [projectId, testScriptFilePath]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getExecutionStats,
  getMostFailed,
  getByProjectIdAndTestScriptName,
  getByProjectIdAndTestScriptFilePath,
};
