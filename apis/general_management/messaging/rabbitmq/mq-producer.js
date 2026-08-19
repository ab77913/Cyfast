"use strict";

const amqp = require("amqplib/callback_api");
const config = require("../../config.js");

const testConnection = async (url) => {
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        throw error0;
      }
      console.log("RabbitMQ connection established to - ", url);

      connection.close();
    });
  } catch (error) {
    console.log(error);
  }
};

const sendToQueue = async (queue, message) => {
  let url =
    "amqp://" +
    config.mq_config.host +
    ":" +
    config.mq_config.port +
    "?frameMax=0";
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

        channel.sendToQueue(queue, Buffer.from(message));
        console.log("Sent message to queue - ", queue);
      });

      setTimeout(function () {
        connection.close();
      }, 500);
    });
  } catch (error) {
    console.log(error);
  }
};

const sendToExchange = async (exchange, type, routingKey, message) => {
  let url =
    "amqp://" +
    config.mq_config.host +
    ":" +
    config.mq_config.port +
    "?frameMax=0";
  try {
    // Code to send message over rabbit mq exchange

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

        channel.assertExchange(exchange, type, { durable: false });

        channel.publish(exchange, routingKey, Buffer.from(message));
        console.log(
          "Sent message to exchange - ",
          exchange,
          " with routing key - ",
          routingKey
        );
      });
    });
  } catch (error) {
    console.log(error);
  }
};

/**
 * Persistent queue publish (broker must use matching durable assertion on consume).
 */
const sendPersistentToQueue = (queue, messageObj) => {
  const payload =
    typeof messageObj === "string" ? messageObj : JSON.stringify(messageObj);
  let url =
    "amqp://" +
    config.mq_config.host +
    ":" +
    config.mq_config.port +
    "?frameMax=0";
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        console.error(
          "RabbitMQ sendPersistentToQueue connect:",
          error0.message,
        );
        return;
      }
      connection.createChannel((error1, channel) => {
        if (error1) {
          console.error(
            "RabbitMQ sendPersistentToQueue channel:",
            error1.message,
          );
          return;
        }
        channel.assertQueue(queue, { durable: true });
        const ok = channel.sendToQueue(queue, Buffer.from(payload), {
          persistent: true,
        });
        if (!ok) console.warn("RabbitMQ sendPersistentToQueue buffer full:", queue);
      });

      setTimeout(() => {
        connection.close();
      }, 500);
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  testConnection,
  sendToQueue,
  sendPersistentToQueue,
  sendToExchange,
};
