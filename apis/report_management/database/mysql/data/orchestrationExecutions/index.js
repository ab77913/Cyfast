"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const mysql = require("mysql2/promise");

const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl: {
    rejectUnauthorized: true, // Set this to false if you want to allow self-signed certificates
  },
};

const getById = async (orchestrationExecutionId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrationExecutions");
    console.log("SQL - ", sqlQueries.executionById);

    const [rows] = await pool.query(sqlQueries.executionById, [
      orchestrationExecutionId,
    ]);

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

const getLatestByOrchestrationId = async (orchestrationId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrationExecutions");
    console.log("SQL - ", sqlQueries.latestExecutionByOrchestrationId);

    const [rows] = await pool.query(
      sqlQueries.latestExecutionByOrchestrationId,
      [orchestrationId]
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getById,
  getLatestByOrchestrationId,
};
