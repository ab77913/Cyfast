"use strict";
const axios = require("axios");
const config = require("../../config");
const producer = require("../../messaging/rabbitmq/mq-producer");
const { model } = require("../../database/mysql/factories/windows-w1-factory");
const { getInternalApiToken } = require("./windows-security-config");

function gatewayHeaders() {
  return {
    authorization: `Bearer ${getInternalApiToken()}`,
  };
}

async function dispatchCommandToGateway(payload) {
  const base = (process.env.AGENT_GATEWAY_URL || "http://127.0.0.1:8094").replace(/\/$/, "");
  await axios.post(`${base}/v1/commands/dispatch`, payload, {
    headers: gatewayHeaders(),
    timeout: 15000,
  });
}

async function publishPending(limit = 50) {
  if (config.mq_type !== "rabbitmq" && process.env.WINDOWS_OUTBOX_HTTP_DISPATCH !== "true") {
    // Still allow HTTP dispatch for local W1 without RabbitMQ.
  }
  const events = await model("WindowsOutboxEvent").findAll({
    where: { published_at: null, deleted_date: null },
    order: [["created_date", "ASC"]],
    limit,
  });
  for (const event of events) {
    try {
      if (config.mq_type === "rabbitmq" && config.mq_queues?.windows_outbox_v1) {
        producer.sendPersistentToQueue(config.mq_queues.windows_outbox_v1, {
          event_type: event.event_type,
          aggregate_id: event.aggregate_id,
          payload: event.payload,
          correlation_id: event.correlation_id,
        });
      }
      if (event.event_type === "windows.command.requested.v1") {
        await dispatchCommandToGateway(event.payload);
        const command = await model("ExecutionCommand").findByPk(event.aggregate_id);
        if (command) {
          await command.update({
            status: "DISPATCHED",
            attempt_count: Number(command.attempt_count || 0) + 1,
          });
        }
      }
      await event.update({
        published_at: new Date(),
        attempts: Number(event.attempts || 0) + 1,
      });
    } catch (error) {
      const attempts = Number(event.attempts || 0) + 1;
      const status = error?.response?.status;
      const code = error?.response?.data?.code || error?.code;
      const permanent =
        status === 400 ||
        code === "COMMAND_EXPIRED" ||
        code === "COMMAND_INVALID" ||
        code === "COMMAND_REJECTED" ||
        code === "COMMAND_NOT_ALLOWED" ||
        attempts >= 20;
      if (event.event_type === "windows.command.requested.v1") {
        const command = await model("ExecutionCommand").findByPk(event.aggregate_id);
        if (command) {
          const expired = new Date(command.expires_at) <= new Date() || code === "COMMAND_EXPIRED";
          await command.update({
            attempt_count: Number(command.attempt_count || 0) + 1,
            ...(expired ? { status: "EXPIRED" } : {}),
            ...(!expired && permanent ? { status: "REJECTED" } : {}),
          });
        }
      }
      // Stop poisoning the dispatch loop: permanent command failures are terminal.
      await event.update({
        attempts,
        ...(permanent ? { published_at: new Date() } : {}),
      });
      console.warn("windows outbox publish failed", event.windows_outbox_event_id, error.message);
    }
  }
  return events.length;
}

module.exports = { publishPending, dispatchCommandToGateway };
