"use strict";

const config = require("../../../config");
const dbConfigSecondary = config.database_secondary;

const { Client } = require("@elastic/elasticsearch");

const tblIndices = ["report_sections", "report_design_templates", "report_templates"];

const elasticClient = new Client({
  node: "http://" + dbConfigSecondary.host + ":" + dbConfigSecondary.port,
  auth: {
    username: dbConfigSecondary.username,
    password: dbConfigSecondary.password,
  },
});

elasticClient.nodeUrl = "http://" + dbConfigSecondary.host + ":" + dbConfigSecondary.port;

console.log("Checking Elasticsearch connection...");
elasticClient.ping({}, (error) => {
  if (error) {
    console.log("Elasticsearch cluster is down!");
  } else {
    console.log("Elasticsearch cluster is up!");
  }
});

//Check indices are created
//Create if not exists
console.log("Checking Elasticsearch indices...");
tblIndices.forEach(async (tblIndex) => {
  if (!(await elasticClient.indices.exists({ index: tblIndex }))) {
    let result = await elasticClient.indices.create({
      index: tblIndex,
    });

    if (result && result.acknowledged) {
      console.log(tblIndex + " index created");
    }
  } else {
    console.log(tblIndex + " index already exists");
  }
});

module.exports = elasticClient;
