"use strict";

const config = require("../../../config");
const fs = require("fs-extra");
const { join } = require("path");

const loadSqlQueries = async (folderName) => {
  // Update the path to load MySQL queries
  const filePath = join(process.cwd(), "database", config.db_type_primary, "data", folderName);

  // Read all files from the folder
  const files = await fs.readdir(filePath);

  // Filter only the SQL files
  const sqlFiles = files.filter((f) => f.endsWith(".sql"));

  const queries = {};

  // Read each SQL file and load the query into the queries object
  for (const sqlfile of sqlFiles) {
    const query = fs.readFileSync(join(filePath, sqlfile), {
      encoding: "UTF-8",
    });

    // Store the query with the file name (without the extension) as the key
    queries[sqlfile.replace(".sql", "")] = query;
  }

  return queries;
};

module.exports = {
  loadSqlQueries,
};
