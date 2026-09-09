import { env } from "../config/env.js";
import { pool, withTransaction } from "../config/db.js";
import { logger } from "../config/logger.js";
import { StatusCode } from "../constants/statusCodes.js";
import { outboxRepository } from "../repositories/outbox.repository.js";

let stopping = false;

async function claimBatch() {
  return withTransaction((conn) =>
    outboxRepository.claimBatch(
      {
        pendingStatus: StatusCode.PENDING,
        failedStatus: StatusCode.FAILED,
        processingStatus: StatusCode.PROCESSING,
        batchSize: env.OUTBOX_BATCH_SIZE,
      },
      conn,
    ),
  );
}

async function publish(event) {
  // Production integration point: replace with Kafka/RabbitMQ/SNS/SQS publisher.
  logger.info(
    {
      eventId: event.event_id,
      eventType: event.event_type,
      payload: event.payload,
    },
    "Outbox event published",
  );
}

async function tick() {
  try {
    const events = await claimBatch();
    for (const event of events) {
      try {
        await publish(event);
        await outboxRepository.markPublished(event.id, StatusCode.PUBLISHED);
      } catch (error) {
        const backoff = Math.min(
          3600,
          Math.max(5, 2 ** Math.min(event.attempts + 1, 10)),
        );
        await outboxRepository.markFailed(
          event.id,
          StatusCode.FAILED,
          error.message,
          backoff,
        );
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Outbox worker tick failed");
  }
}
async function run() {
  logger.info("Outbox worker started");
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, env.OUTBOX_INTERVAL_MS));
  }
  await pool.end();
}
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
run();
