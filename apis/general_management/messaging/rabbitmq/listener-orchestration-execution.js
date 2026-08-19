"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");

const executionService = require("../../services/execution-service");

let isConnected = false;

const retryConnection = (url, queue) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    if (!isConnected) listenToQueue(url, queue);
  }, 5000);
};

const retryExchangeConnection = (url, exchange) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    if (!isConnected) listenToExchange(url, exchange);
  }, 5000);
};

const listenToQueue = async (url, queue) => {
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
        console.log("RabbitMQ channel created for queue - ", queue);

        channel.assertQueue(queue, { durable: false });

        channel.consume(
          queue,
          async (message) => {
            let data = JSON.parse(message.content.toString());
            console.log(
              "Received orchestration execution message for -",
              queue
            );

            let orchestrationExecution =
              await executionService.updateOrchestrationExecutionResult(data);
          },
          {
            noAck: true,
          }
        );
      });

      connection.on("close", function () {
        console.log("Connection closed for queue - ", queue);

        retryConnection(url, queue);
      });
      connection.on("error", function (e) {
        console.log("Connection closed because of error - ", e);

        retryConnection(url, queue);
      });
    });
  } catch (error) {
    console.log(error);

    retryConnection(url, queue);
  }
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

          channel.bindQueue(q.queue, exchange, "#.executioncomplete");

          channel.consume(
            q.queue,
            async (message) => {
              let data = JSON.parse(message.content.toString());
              console.log(
                "Received orchestration execution message for -",
                exchange
              );

              let orchestrationExecution =
                await executionService.updateOrchestrationExecutionResult(data);
            },
            {
              noAck: true,
            }
          );
        });
      });

      connection.on("close", function () {
        console.log("Connection closed for exchange - ", exchange);

        retryExchangeConnection(url, exchange);
      });
      connection.on("error", function (e) {
        console.log("Connection closed because of error - ", e);

        retryExchangeConnection(url, exchange);
      });
    });
  } catch (error) {
    console.log(error);

    retryExchangeConnection(url, exchange);
  }
};

module.exports = {
  listenToQueue,
  listenToExchange,
};
