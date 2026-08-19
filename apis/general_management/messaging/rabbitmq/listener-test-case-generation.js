"use strict";

const amqp = require("amqplib/callback_api");
const testCaseGenerationService = require("../../services/test-case-generation-service.js");

function retry(url, queue) {
  setTimeout(() => listenToQueue(url, queue), 5000);
}

function listenToQueue(url, queue) {
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        console.error(
          "RabbitMQ test_case_generation listener connect:",
          error0.message,
        );
        retry(url, queue);
        return;
      }
      console.log("RabbitMQ test_case_generation listener connected");

      connection.createChannel((error1, channel) => {
        if (error1) {
          console.error(
            "RabbitMQ test_case_generation listener channel:",
            error1.message,
          );
          connection.close();
          retry(url, queue);
          return;
        }

        channel.assertQueue(queue, { durable: true });
        channel.prefetch(1);

        channel.consume(
          queue,
          async (msg) => {
            if (!msg) return;
            try {
              const envelope = JSON.parse(msg.content.toString());
              console.log(
                "test_case_generation queue:",
                envelope.kind,
                "job_id=",
                envelope.job_id,
              );
              await testCaseGenerationService.processTestCaseGenerationQueueMessage(
                envelope,
              );
            } catch (e) {
              console.error("test_case_generation consumer error:", e);
            } finally {
              channel.ack(msg);
            }
          },
          { noAck: false },
        );
      });

      connection.on("error", (err) =>
        console.error("test_case_generation connection error:", err.message),
      );
      connection.on("close", () => {
        console.log("test_case_generation connection closed; reconnecting…");
        retry(url, queue);
      });
    });
  } catch (e) {
    console.error(e);
    retry(url, queue);
  }
}

module.exports = { listenToQueue };
