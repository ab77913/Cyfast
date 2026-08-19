"use strict";

const amqp = require("amqplib");

var connection;
var channel;

const connectQueue = async (url, queue) => {
  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertQueue(queue, { durable: false });
    channel.close();
  } catch (error) {
    console.log(error);
    //process.exit(0);
  }
};

const connectExchange = async (url, exchange) => {
  try {
    channel = await connection.createChannel();

    await channel.assertExchange(exchange, "fanout", { durable: false });
  } catch (error) {
    console.log(error);
    //process.exit(0);
  }
};

const publishToQueue = async (queue, message) => {
  try {
    const published = await channel.sendToQueue(queue, Buffer.from(message));

    return published;
  } catch (error) {
    console.log(error);
  }
};

const publishToExchange = async (exchange, message) => {
  try {
    const published = await channel.publish(exchange, "", Buffer.from(message));

    return published;
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  connectQueue,
  connectExchange,
  publishToQueue,
  publishToExchange,
};
