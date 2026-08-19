"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");
const consoleLogFactory = require("../../database/" + config.db_type_secondary + "/factories/consoleLogFactory");

const retryConnection = (url, exchange) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    listenToExchange(url, exchange);
  }, 5000);
};

const listenToExchange = async (url, exchange) => {
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        throw error0;
      }
      console.log("RabbitMQ connection established to - ", url);

      connection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
        }
        console.log("RabbitMQ channel created for exchange - ", exchange);

        channel.assertExchange(exchange, "topic", { durable: false });

        channel.assertQueue("", { exclusive: true }, (error2, q) => {
          if (error2) {
            throw error2;
          }

          channel.bindQueue(q.queue, exchange, "#.consolelogs");

          channel.consume(
            q.queue,
            (message) => {
              let data = JSON.parse(message.content.toString());

              console.log("Received console log message from -", data.agent_name);
              let consoleLog = {
                orchestration_execution_id: data.orchestration_execution_id,
                agent: { id: data.agent_id, name: data.agent_name, type: data.agent_type ?? "" },
                environment: { id: data.environment_id, name: data.environment_name ?? "" },
                project_id: data.project_id,
                orchestration_id: data.orchestration_id,
                username: data.user_id,
                logs: [{ text: data.log_text, generated_time: data.log_generated_time ?? "" }],
              };

              consoleLogFactory.createLog(consoleLog);
              channel.ack(message);
            },
            {
              noAck: false,
            }
          );
        });
      });

      connection.on("close", function () {
        console.log("Connection closed");

        retryConnection(url, exchange);
      });
      connection.on("error", function (e) {
        console.log("Connection closed");

        retryConnection(url, exchange);
      });
    });
  } catch (error) {
    console.log(error);

    retryConnection(url, exchange);
    //process.exit(0);
  }
};

module.exports = {
  listenToExchange,
};
