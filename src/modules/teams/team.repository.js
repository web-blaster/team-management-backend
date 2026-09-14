import { pool } from '../../config/db.js';

export class TeamRepository {
  constructor(db = pool) { this.db = db; }
  async findByPublicId(publicId, db = this.db, forUpdate = false) {
    const [rows]=await db.execute(
      `SELECT id,public_id,name,description,status_code FROM teams WHERE public_id=? LIMIT 1 ${forUpdate ? 'FOR UPDATE' : ''}`,
      [publicId]
    );
    return rows[0] ?? null;
  }
  async listForUser(userId, isAdmin, activeStatus, archivedStatus, db = this.db) {
    const [rows]=await db.execute(
      isAdmin
        ? `SELECT public_id,name,description,status_code FROM teams WHERE status_code IN (?,?) ORDER BY name`
        : `SELECT t.public_id,t.name,t.description,t.status_code
             FROM team_members tm JOIN teams t ON t.id=tm.team_id
            WHERE tm.user_id=? AND tm.removed_at IS NULL ORDER BY t.name`,
      isAdmin ? [activeStatus,archivedStatus] : [userId]
    );
    return rows;
  }
  async listActiveForUser(userId, isAdmin, activeStatus, db = this.db) {
    const [rows]=await db.execute(
      isAdmin
        ? `SELECT public_id,name FROM teams WHERE status_code=? ORDER BY name`
        : `SELECT t.public_id,t.name FROM team_members tm JOIN teams t ON t.id=tm.team_id
            WHERE tm.user_id=? AND tm.removed_at IS NULL AND t.status_code=? ORDER BY t.name`,
      isAdmin ? [activeStatus] : [userId,activeStatus]
    );
    return rows;
  }
  async create(data, db = this.db) {
    const [result]=await db.execute(
      'INSERT INTO teams (public_id,name,description,status_code) VALUES (?,?,?,?)',
      [data.publicId,data.name,data.description ?? null,data.statusCode]
    );
    return result.insertId;
  }
  async isActiveMember(teamId,userId,db=this.db) {
    const [rows]=await db.execute(
      'SELECT 1 FROM team_members WHERE team_id=? AND user_id=? AND removed_at IS NULL LIMIT 1',
      [teamId,userId]
    );
    return rows.length>0;
  }
  async update(id, changes, db = this.db) {
    const fields = [], values = [];
    if (changes.name !== undefined) {
      fields.push('name=?');
      values.push(changes.name);
    }
    if (changes.description !== undefined) {
      fields.push('description=?');
      values.push(changes.description);
    }
    if (!fields.length) return;
    await db.execute(`UPDATE teams SET ${fields.join(',')} WHERE id=?`, [...values, id]);
  }
  async hasRelatedRecords(teamId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT (
        EXISTS(SELECT 1 FROM team_members WHERE team_id=?) OR
        EXISTS(SELECT 1 FROM projects WHERE team_id=?) OR
        EXISTS(SELECT 1 FROM reporting_periods WHERE team_id=?) OR
        EXISTS(SELECT 1 FROM weekly_reports WHERE team_id=?) OR
        EXISTS(SELECT 1 FROM user_invitations WHERE team_id=?) OR
        EXISTS(SELECT 1 FROM activity_logs WHERE team_id=?)
      ) AS in_use`,
      Array(6).fill(teamId)
    );
    return Boolean(Number(rows[0].in_use));
  }
  async remove(id, db = this.db) {
    await db.execute('DELETE FROM teams WHERE id=?', [id]);
  }
  async listMembers(teamId, db=this.db) {
    const [rows]=await db.execute(
      `SELECT u.public_id,u.first_name,u.last_name,u.email,u.status_code,
              GROUP_CONCAT(DISTINCT r.code ORDER BY r.code) roles
         FROM team_members tm JOIN users u ON u.id=tm.user_id
         LEFT JOIN user_roles ur ON ur.user_id=u.id
         LEFT JOIN m_roles r ON r.id=ur.role_id
        WHERE tm.team_id=? AND tm.removed_at IS NULL
        GROUP BY u.id ORDER BY u.first_name,u.last_name`,[teamId]
    );
    return rows.map(r=>({...r,roles:r.roles?r.roles.split(','):[]}));
  }
  async findMembership(teamId,userId,db=this.db) {
    const [rows]=await db.execute(
      'SELECT id,removed_at FROM team_members WHERE team_id=? AND user_id=? LIMIT 1',[teamId,userId]
    );
    return rows[0] ?? null;
  }
  async restoreMembership(id,db=this.db) {
    await db.execute('UPDATE team_members SET removed_at=NULL,joined_at=CURRENT_TIMESTAMP(6) WHERE id=?',[id]);
  }
  async addMember(teamId,userId,db=this.db) {
    await db.execute('INSERT INTO team_members (team_id,user_id) VALUES (?,?)',[teamId,userId]);
  }
  async removeMember(teamId,userId,db=this.db) {
    const [result]=await db.execute(
      'UPDATE team_members SET removed_at=CURRENT_TIMESTAMP(6) WHERE team_id=? AND user_id=? AND removed_at IS NULL',
      [teamId,userId]
    );
    return result.affectedRows;
  }
}
export const teamRepository = new TeamRepository();
