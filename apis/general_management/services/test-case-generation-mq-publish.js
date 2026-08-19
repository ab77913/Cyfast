"use strict";

const amqp = require("amqplib");
const config = require("../config.js");

function buildUrl() {
  const c = config.mq_config;
  return "amqp://" + c.host + ":" + c.port + "?frameMax=0";
}

function queueName() {
  return (
    config.mq_queues.test_case_generation_request ||
    "test_case_generation_request"
  );
}

/**
 * @param {{
 *   kind: "generate"|"regenerate";
 *   job_id: number;
 *   notify_user_id?: string|null;
 *   candidate_ids?: number[];
 * }} envelope
 * @returns {Promise<void>}
 */
async function publishTestCaseGeneration(envelope) {
  const queue = queueName();
  const url = buildUrl();
  const conn = await amqp.connect(url);
  try {
    const ch = await conn.createChannel();
    await ch.assertQueue(queue, { durable: true });
    const ok = ch.sendToQueue(queue, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
    });
    await ch.close();
    if (!ok) {
      throw new Error("RabbitMQ send buffer full");
    }
  } finally {
    await conn.close().catch(() => {});
  }
}

module.exports = {
  publishTestCaseGeneration,
};
