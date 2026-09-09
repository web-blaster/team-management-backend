import { pool } from '../config/db.js';

export class OutboxRepository {
  constructor(db=pool){this.db=db;}
  async create(data,db=this.db){
    const [result]=await db.execute(
      `INSERT INTO outbox_events
       (event_id,aggregate_type,aggregate_id,event_type,payload,status_code)
       VALUES (?,?,?,?,?,?)`,
      [data.eventId,data.aggregateType,String(data.aggregateId),data.eventType,JSON.stringify(data.payload),data.statusCode]
    );
    return result.insertId;
  }
  async claimBatch({pendingStatus,failedStatus,processingStatus,batchSize},db=this.db){
    const [rows]=await db.query(
      `SELECT id,event_id,aggregate_type,aggregate_id,event_type,payload,attempts
         FROM outbox_events
        WHERE status_code IN (?,?) AND available_at<=CURRENT_TIMESTAMP(6)
        ORDER BY id LIMIT ? FOR UPDATE SKIP LOCKED`,
      [pendingStatus,failedStatus,batchSize]
    );
    if(rows.length){
      const ids=rows.map(r=>r.id);
      await db.query(
        `UPDATE outbox_events SET status_code=?,attempts=attempts+1
          WHERE id IN (${ids.map(()=>'?').join(',')})`,
        [processingStatus,...ids]
      );
    }
    return rows;
  }
  async markPublished(id,statusCode,db=this.db){
    await db.execute(
      'UPDATE outbox_events SET status_code=?,published_at=CURRENT_TIMESTAMP(6),last_error=NULL WHERE id=?',
      [statusCode,id]
    );
  }
  async markFailed(id,statusCode,error,backoffSeconds,db=this.db){
    await db.execute(
      `UPDATE outbox_events
          SET status_code=?,last_error=?,available_at=DATE_ADD(CURRENT_TIMESTAMP(6),INTERVAL ? SECOND)
        WHERE id=?`,
      [statusCode,String(error).slice(0,5000),backoffSeconds,id]
    );
  }
}
export const outboxRepository=new OutboxRepository();
