"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");

const projectFactory = require("../../database/" +
  config.db_type_primary +
  "/factories/project-factory");

const retryConnection = (url, queue) => {
  setTimeout(() => {
    console.log("Retrying RabbitMQ connection...");
    listenToQueue(url, queue);
  }, 5000);
};

const listenToQueue = async (url, queue) => {
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
        console.log("RabbitMQ channel created for queue - ", queue);

        channel.assertQueue(queue, { durable: false });

        channel.consume(
          queue,
          (message) => {
            let data = JSON.parse(message.content.toString());

            console.log(
              "Received project update message for -",
              data.ProjectName
            );
            let projectData = {
              status: data.ProjectStatus,

              //TODO - add other fields
            };

            projectFactory.update(data.project_id, projectData);
            channel.ack(message);
          },
          {
            noAck: false,
          }
        );
      });

      connection.on("close", function () {
        console.log("Connection closed");

        retryConnection(url, queue);
      });
      connection.on("error", function (e) {
        console.log("Connection closed");

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

          channel.bindQueue(q.queue, exchange, "#.projectstatus");

          channel.consume(
            q.queue,
            (message) => {
              let data = JSON.parse(message.content.toString());

              console.log(
                "Received project update message for -",
                data.ProjectName
              );
              let projectData = {
                status: data.ProjectStatus,
                //TODO - add other fields
              };

              projectFactory.update(data.project_id, projectData);
            },
            {
              noAck: true,
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
  }
};

module.exports = {
  listenToQueue,
  listenToExchange,
};
