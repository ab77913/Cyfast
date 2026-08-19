"use strict";

const config = require("../../../config");

const dbConfig = config.database_secondary;

const { Client } = require("@elastic/elasticsearch");

const tblIndices = ["activity_logs", "application_logs", "audit_logs", "console_logs", "execution_logs"];

const elasticClient = new Client({
  node: "http://" + dbConfig.host + ":" + dbConfig.port,
  auth: {
    username: dbConfig.username,
    password: dbConfig.password,
  },
});

elasticClient.nodeUrl = "http://" + dbConfig.host + ":" + dbConfig.port;

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

    /*if (tblIndex == "console_logs") {
      elasticClient.indices.putMapping(
        {
          index: "tblIndex",
          body: {
            properties: {
              firstname: { type: "text" },
              lastname: { type: "text" },
              email: { type: "text" },
              phone_number: { type: "text" },
              created_on: { type: "date" },
              updated_at: { type: "date" },
            },
          },
        },
        (err, resp, status) => {
          if (err) {
            console.error(err, status);
          } else {
            console.log("Successfully Created Index", status, resp);

            elasticClient.indices.putMapping(
              {
                index: "users",
                type: "staff",
                body: {
                  properties: {
                    orchestration_execution_id: {
                      type: "text",
                      fields: {
                        keyword: {
                          type: "keyword",
                        },
                      },
                    },
                  },
                },
              },
              (err, resp, status) => {
                if (err) {
                  console.error(err, status);
                } else {
                  console.log("Successfully mapped index", status, resp);
                }
              }
            );
          }
        }
      );
    }*/
  } else {
    console.log(tblIndex + " index already exists");
  }
});

module.exports = elasticClient;
