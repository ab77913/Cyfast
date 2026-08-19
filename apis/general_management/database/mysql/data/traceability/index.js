"use strict";
const utils = require("../utils");

const getForwardTraceability = async (projectId, testCaseIds = null) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(sqlQueries.forwardTraceability, [
      projectId,
      testCaseIds,
    ]);
    //console.log("Forward Traceability Rows:", rows);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getRequirementCoverageByProjectId = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(sqlQueries.requirementCoverageByProjectId, [
      projectId,
      projectId,
    ]);
    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getRiskRequirementCoverageByProjectId = async (projectId) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(
      sqlQueries.riskRequirementCoverageByProjectId,
      [projectId, projectId]
    );
    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getRequirementTestTraceability = async (
  projectId,
  testCaseIds = null
) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(sqlQueries.requirementTestTraceability, [
      projectId,
      projectId,
      projectId,
      projectId,
      projectId,
    ]);

    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getRiskRequirementTraceability = async (
  projectId,
  testCaseIds = null
) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(sqlQueries.riskRequirementTraceability, [
      projectId,
      projectId,
    ]);
    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getRiskRequirementTestTraceability = async (
  projectId,
  testCaseIds = null
) => {
  try {
    const pool = utils.pool;
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.query(
      sqlQueries.riskRequirementTestTraceability,
      [projectId, projectId, projectId, projectId, projectId]
    );
    return rows;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getForwardTraceability,
  getRequirementCoverageByProjectId,
  getRiskRequirementCoverageByProjectId,
  getRequirementTestTraceability,
  getRiskRequirementTraceability,
  getRiskRequirementTestTraceability,
};
