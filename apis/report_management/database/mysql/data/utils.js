"use strict";

const config = require("../../../config");
const fs = require("fs-extra");
const { join } = require("path");

const loadSqlQueries = async (folderName) => {
  const filePath = join(process.cwd(), "database", config.db_type_primary, "data", folderName);
  
  // Ensure folder path for MySQL is correct (config.db_type_primary should point to 'mysql')
  const files = await fs.readdir(filePath);
  const sqlFiles = files.filter((f) => f.endsWith(".sql"));
  const queries = {};
  
  for (const sqlfile of sqlFiles) {
    const query = fs.readFileSync(join(filePath, sqlfile), {
      encoding: "UTF-8",
    });
    queries[sqlfile.replace(".sql", "")] = query;
  }
  
  return queries;
};

module.exports = {
  loadSqlQueries,
};
