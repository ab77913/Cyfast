"use strict";

const amqp = require("amqplib/callback_api");
const testScenarioGenerationService = require("../../services/test-scenario-generation-service.js");

function retry(url, queue) {
  setTimeout(() => listenToQueue(url, queue), 5000);
}

function listenToQueue(url, queue) {
  try {
    amqp.connect(url, (error0, connection) => {
      if (error0) {
        console.error(
          "RabbitMQ test_scenario_generation listener connect:",
          error0.message,
        );
        retry(url, queue);
        return;
      }
      console.log("RabbitMQ test_scenario_generation listener connected");

      connection.createChannel((error1, channel) => {
        if (error1) {
          console.error(
            "RabbitMQ test_scenario_generation listener channel:",
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
                "test_scenario_generation queue:",
                envelope.kind,
                "job_id=",
                envelope.job_id,
              );
              await testScenarioGenerationService.processTestScenarioGenerationQueueMessage(
                envelope,
              );
            } catch (e) {
              console.error("test_scenario_generation consumer error:", e);
            } finally {
              channel.ack(msg);
            }
          },
          { noAck: false },
        );
      });

      connection.on("error", (err) =>
        console.error(
          "test_scenario_generation connection error:",
          err.message,
        ),
      );
      connection.on("close", () => {
        console.log(
          "test_scenario_generation connection closed; reconnecting…",
        );
        retry(url, queue);
      });
    });
  } catch (e) {
    console.error(e);
    retry(url, queue);
  }
}

module.exports = { listenToQueue };
