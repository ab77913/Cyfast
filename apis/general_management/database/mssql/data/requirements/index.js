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

const getExecutionStats = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("requirements");
    const event = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.executionStats);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

const getMostFailed = async (projectId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("requirements");
    const event = await pool.request().input("projectId", sql.Int, projectId).query(sqlQueries.mostFailed);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getExecutionStats,
  getMostFailed,
};
