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

const getStatDetails = async (organizationId) => {
  try {
    let pool = await sql.connect(dbConfig);
    const sqlQueries = await utils.loadSqlQueries("dashboards");
    const event = await pool.request().input("organizationId", sql.Int, organizationId).query(sqlQueries.statisticsDetails);

    return event.recordset;
  } catch (error) {
    console.log(error);
    return error.message;
  }
};

module.exports = {
  getStatDetails,
};
