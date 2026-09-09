import { StatusCode } from "../constants/statusCodes.js";
import { uuid } from "../utils/core.js";
import { auditRepository } from "../repositories/audit.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";

export async function activity(conn, data) {
  return auditRepository.createActivity(data, conn);
}
export async function outbox(
  conn,
  { aggregateType, aggregateId, eventType, payload },
) {
  return outboxRepository.create(
    {
      eventId: uuid(),
      aggregateType,
      aggregateId,
      eventType,
      payload,
      statusCode: StatusCode.PENDING,
    },
    conn,
  );
}
