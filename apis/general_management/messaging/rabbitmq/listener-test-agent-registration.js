"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");

const testAgentService = require("../../services/test-agent-service.js");

let isConnected = false;

const retryConnection = (url, queue) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    if (!isConnected) listenToQueue(url, queue);
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

        channel.assertExchange(exchange, "direct", {
          durable: false,
        });
        console.log("RabbitMQ channel created for exchange - ", exchange);

        channel.assertQueue("", { exclusive: true }, (error2, q) => {
          if (error2) {
            throw error2;
          }

          channel.bindQueue(q.queue, exchange, "register");

          channel.consume(
            q.queue,
            async (message) => {
              let data = JSON.parse(message.content.toString());
              console.log(
                "Received test agent registration message on exchange - ",
                exchange
              );

              let agentRegistration = await testAgentService.registerTestAgent(
                data
              );
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
