"use strict";

const amqp = require("amqplib");
const config = require("../../config.js");
const consoleLogFactory = require("../../database/" + config.db_type_secondary + "/factories/consoleLogFactory");

var connection;
var channel;

const listenToQueue = async (url, queue) => {
  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertQueue(queue, { durable: false });

    channel.consume(queue, (message) => {
      const data = JSON.parse(message.content.toString());
      channel.ack(message);

      consoleLogFactory.createLog(data);
    });
  } catch (error) {
    console.log(error);
    //process.exit(0);
  }
};

module.exports = {
  listenToQueue,
};
