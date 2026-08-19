"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");
const helpers = require("../../helpers/index.js");

const testAgentService = require("../../services/test-agent-service");

let isConnected = false;

const retryConnection = (url, exchange) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    if (!isConnected) listenToExchange(url, exchange);
  }, 5000);
};

const listenToExchange = async (url, exchange) => {
  try {
    amqp.connect(url, (error0, connection) => {
      isConnected = true;
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

          channel.bindQueue(q.queue, exchange, "#.ack");

          channel.consume(
            q.queue,
            async (message) => {
              let data = JSON.parse(message.content.toString());
              // console.log(
              //   "Received test agent heartbeat message on exchange - ",
              //   exchange
              // );

              testAgentService.updateHeartbeat(data);
            },
            {
              noAck: true,
            }
          );
        });
      });

      connection.on("close", function () {
        console.log("Connection closed for exchange - ", exchange);

        retryConnection(url, exchange);
      });
      connection.on("error", function (e) {
        console.log(
          "Error occured. Connection closed for exchange - ",
          exchange
        );
        console.log(e);

        retryConnection(url, exchange);
      });
    });
  } catch (error) {
    console.log(error);

    retryConnection(url, exchange);
  }
};

module.exports = {
  listenToExchange,
};
