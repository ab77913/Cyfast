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

const getRequirementCoverageByProjectId = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.execute(
      sqlQueries.requirementCoverageByProjectId,
      [projectId]
    );
    return rows;
  } catch (error) {
    return error.message;
  }
};

const getRiskRequirementCoverageByProjectId = async (projectId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("traceability");
    const [rows] = await pool.execute(
      sqlQueries.riskRequirementCoverageByProjectId,
      [projectId]
    );
    return rows;
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getRequirementCoverageByProjectId,
  getRiskRequirementCoverageByProjectId,
};
