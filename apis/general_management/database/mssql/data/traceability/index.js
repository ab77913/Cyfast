"use strict";
const utils = require("../utils");
const sql = require("mssql");

const config = require("../../../../config.js");

const dbConfig = {
  server: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  options: {
    encrypt: config.database_primary.sql_encrypt !== undefined ? config.database_primary.sql_encrypt : true,
  },
};

const getRequirementTestTraceability = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.requirementTestTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getRiskRequirementTraceability = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.riskRequirementTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getRiskRequirementTestTraceability = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.riskRequirementTestTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getEndToEndTraceability = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.endToEndTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getForwardTraceability = async (searchQuery, projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("SearchQuery", sql.VarChar, searchQuery)
      .query(sqlQueries.forwardTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getBackwardTraceability = async (searchQuery, projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool
      .request()
      .input("projectId", sql.Int, projectId)
      .input("SearchQuery", sql.VarChar, searchQuery)
      .query(sqlQueries.backwardTraceability);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getRequirementInsights = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.requirementInsights);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getTestInsights = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.testInsights);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getRiskInsights = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.riskInsights);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const getRequirementExecutionStats = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.requirementExecutionStats);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

const countRedundantRequirements = async (projectId, organizationId = null) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const result = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.redundantRequirements);
    return result.recordset;
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getEndToEndTraceability,
  getRequirementTestTraceability,
  getRiskRequirementTraceability,
  getRiskRequirementTestTraceability,
  getForwardTraceability,
  getBackwardTraceability,
  getRequirementInsights,
  getTestInsights,
  getRiskInsights,
  getRequirementExecutionStats,
  countRedundantRequirements,
};
