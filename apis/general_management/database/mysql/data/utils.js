"use strict";

const mysql = require("mysql2/promise");
const config = require("../../../config");
const fs = require("fs-extra");
const { join } = require("path");

// MySQL Database Configuration
const dbConfig = {
  host: config.database_primary.host,
  database: config.database_primary.database,
  user: config.database_primary.username,
  password: config.database_primary.password,
  ssl:
    config.database_primary.sql_encrypt !== undefined &&
    config.database_primary.sql_encrypt === true
      ? {}
      : null, // SSL if encryption is true
};

// Create the pool ONCE and reuse it
const pool = mysql.createPool(dbConfig);

/**
 * Load SQL queries from files in a specified folder.
 *
 * @param {string} folderName - The name of the folder containing SQL files.
 * @returns {Promise<Object>} - An object where the keys are file names (without extension) and values are the SQL queries as strings.
 */
const loadSqlQueries = async (folderName) => {
  try {
    // Construct the path to the SQL query files
    const filepath = join(
      process.cwd(),
      "database",
      config.db_type_primary,
      "data",
      folderName
    );

    // Read the files in the specified directory
    const files = await fs.readdir(filepath);

    // Filter for files with .sql extension
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));

    // Create an object to hold the SQL queries
    const queries = {};

    // Read each SQL file and store its content
    for (const sqlfile of sqlFiles) {
      const query = await fs.readFile(join(filepath, sqlfile), {
        encoding: "UTF-8",
      });
      queries[sqlfile.replace(".sql", "")] = query;
    }

    return queries;
  } catch (error) {
    console.error("Error loading SQL queries:", error);
    throw error;
  }
};

module.exports = {
  pool,
  loadSqlQueries,
};
