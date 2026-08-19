"use strict";

const utils = require("../utils");
const config = require("../../../../config");
const sql = require("mssql");
const { MAX } = require("mssql");
const dbConfig = {
  server: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  options: {
    encrypt: config.database_primary.sql_encrypt !== undefined ? config.database_primary.sql_encrypt : true,
  },
};

const getWithTestScriptsByIds = async (testCaseIds) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("testCaseIds", sql.VarChar(MAX), testCaseIds.join(","))
      .query(sqlQueries.testCasesWithTestScriptsByIds);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getWithProjectIdAndTestCaseId = async (projectId, testCaseId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("testCaseId", sql.BigInt, testCaseId)
      .query(sqlQueries.testCaseWithProjectIdAndTestCaseId);

    return event.recordset && event.recordset.length > 0 ? event.recordset[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getWithProjectIdAndTestCaseName = async (projectId, testCaseName) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("testCaseName", sql.VarChar(255), testCaseName)
      .query(sqlQueries.testCaseWithProjectIdAndTestCaseName);

    return event.recordset && event.recordset.length > 0 ? event.recordset[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getWithProjectIdAndTestCaseNo = async (projectId, testCaseNo) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("testCaseNo", sql.VarChar(50), testCaseNo)
      .query(sqlQueries.testCaseWithProjectIdAndTestCaseNo);

    return event.recordset && event.recordset.length > 0 ? event.recordset[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getExecutionStats = async (projectId, orchestrationId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("orchestrationId", sql.BigInt, orchestrationId)
      .query(sqlQueries.executionStats);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getMostFailed = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.mostFailed);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getExecutionTrendByOrchestrationId = async (orchestrationId, fromDate = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("testCases");
    const event = await pool
      .request()
      .input("orchestrationId", sql.BigInt, orchestrationId)
      .input("fromDate", sql.VarChar(50), fromDate)
      .query(sqlQueries.executionTrend);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getWithTestScriptsByIds,
  getWithProjectIdAndTestCaseId,
  getWithProjectIdAndTestCaseName,
  getWithProjectIdAndTestCaseNo,
  getExecutionStats,
  getMostFailed,
  getExecutionTrendByOrchestrationId,
};
