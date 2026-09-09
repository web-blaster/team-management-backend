import { pool } from '../config/db.js';

export class AuditRepository {
  constructor(db=pool){this.db=db;}
  async createActivity(data,db=this.db){
    await db.execute(
      `INSERT INTO activity_logs (team_id,actor_user_id,event_type,entity_type,entity_id,metadata)
       VALUES (?,?,?,?,?,?)`,
      [data.teamId??null,data.actorUserId??null,data.eventType,data.entityType,data.entityId??null,
       data.metadata?JSON.stringify(data.metadata):null]
    );
  }
}
export const auditRepository=new AuditRepository();
