"use strict";

const utils = require("../utils");

const getStatDetails = async (organizationId) => {
  try {
    const pool = utils.pool; // Get the MySQL connection pool
    if (!pool) {
      throw new Error("Database connection pool is not initialized.");
    }
    const sqlQueries = await utils.loadSqlQueries("dashboards"); // Load SQL queries

    // Execute the query with MySQL's pool.query method, passing organizationId
    const [rows] = await pool.query(sqlQueries.statisticsDetails, [
      organizationId,
    ]);

    return rows; // Return the query result (rows)
  } catch (error) {
    console.log(error);
    return error.message; // Return error message in case of failure
  }
};

module.exports = {
  getStatDetails,
};
