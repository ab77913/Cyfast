"use strict";
const utils = require("../utils");
const config = require("../../../../config");
const mysql = require("mysql2/promise");
const fs = require("fs");

const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl: {
    rejectUnauthorized: true, // Change to false if using self-signed certificates
    ca: fs.readFileSync("/path/to/ca-cert.pem"), // Optional if needed for your SSL setup
  },
};

const getById = async (orchestrationId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrations");
    const [rows] = await pool.query(sqlQueries.orchestrationById, [
      orchestrationId,
    ]);

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

const getConfigurationsByOrchestrationId = async (orchestrationId) => {
  try {
    const pool = await mysql.createPool(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("orchestrations");
    const [rows] = await pool.query(
      sqlQueries.configurationsByOrchestrationId,
      [orchestrationId]
    );

    return Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  } catch (error) {
    return error.message;
  }
};

module.exports = {
  getById,
  getConfigurationsByOrchestrationId,
};
