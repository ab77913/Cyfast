"use strict";

const utils = require("../utils");

// Fetch test cases with test scripts by IDs
const getWithTestScriptsByIds = async (testCaseIds) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
    const [rows] = await pool.query(sqlQueries.testCasesWithTestScriptsByIds, [
      testCaseIds,
    ]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch test case with project ID and test case ID
const getWithProjectIdAndTestCaseId = async (projectId, testCaseId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
    const [rows] = await pool.query(
      sqlQueries.testCaseWithProjectIdAndTestCaseId,
      [projectId, testCaseId]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch test case with project ID and test case name
const getByProjectIdAndTestCaseName = async (projectId, testCaseName) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
    const [rows] = await pool.query(
      sqlQueries.testCaseByProjectIdAndTestCaseName,
      [projectId, testCaseName]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch test case with project ID and test case number
const getByProjectIdAndTestCaseNo = async (projectId, testCaseNo) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
    const [rows] = await pool.query(
      sqlQueries.testCaseByProjectIdAndTestCaseNo,
      [projectId, testCaseNo]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

// Fetch execution stats by project ID and orchestration ID
const getExecutionStats = async (projectId, orchestrationId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
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

// Fetch most failed test cases by project ID
const getMostFailed = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
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

// Fetch execution trend by orchestration ID and optional fromDate
const getExecutionTrendByOrchestrationId = async (
  orchestrationId,
  fromDate = null
) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("test-cases");
    const [rows] = await pool.query(sqlQueries.executionTrend, [
      orchestrationId,
      orchestrationId,
      fromDate,
      fromDate,
    ]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getWithTestScriptsByIds,
  getWithProjectIdAndTestCaseId,
  getByProjectIdAndTestCaseName,
  getByProjectIdAndTestCaseNo,
  getExecutionStats,
  getMostFailed,
  getExecutionTrendByOrchestrationId,
};
