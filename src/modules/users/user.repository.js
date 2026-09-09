import { pool } from '../../config/db.js';

const USER_COLUMNS = `
  id, public_id, first_name, last_name, email, password_hash,
  status_code, email_verified_at, last_login_at, created_at, updated_at, deleted_at
`;

export class UserRepository {
  constructor(db = pool) { this.db = db; }
  async findByEmail(email, db = this.db) {
    const [rows] = await db.execute(
      `SELECT ${USER_COLUMNS} FROM users WHERE email=? AND deleted_at IS NULL LIMIT 1`, [email]
    );
    return rows[0] ?? null;
  }
  async findActiveByEmail(email, activeStatus, db = this.db) {
    const [rows] = await db.execute(
      `SELECT ${USER_COLUMNS} FROM users WHERE email=? AND status_code=? AND deleted_at IS NULL LIMIT 1`,
      [email, activeStatus]
    );
    return rows[0] ?? null;
  }
  async findById(id, db = this.db) {
    const [rows] = await db.execute(
      `SELECT ${USER_COLUMNS} FROM users WHERE id=? AND deleted_at IS NULL LIMIT 1`, [id]
    );
    return rows[0] ?? null;
  }
  async findByPublicId(publicId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT ${USER_COLUMNS} FROM users WHERE public_id=? AND deleted_at IS NULL LIMIT 1`, [publicId]
    );
    return rows[0] ?? null;
  }
  async findAuthUser(id, publicId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT id,public_id,first_name,last_name,email,status_code
         FROM users WHERE id=? AND public_id=? AND deleted_at IS NULL LIMIT 1`,
      [id, publicId]
    );
    return rows[0] ?? null;
  }
  async create(data, db = this.db) {
    const [result] = await db.execute(
      `INSERT INTO users
       (public_id,first_name,last_name,email,password_hash,status_code,email_verified_at)
       VALUES (?,?,?,?,?,?,?)`,
      [data.publicId,data.firstName,data.lastName,data.email,data.passwordHash,data.statusCode,data.emailVerifiedAt ?? null]
    );
    return this.findById(result.insertId, db);
  }
  async updateLastLogin(userId, db = this.db) {
    await db.execute('UPDATE users SET last_login_at=CURRENT_TIMESTAMP(6) WHERE id=?',[userId]);
  }
  async updatePassword(userId, passwordHash, db = this.db) {
    await db.execute('UPDATE users SET password_hash=? WHERE id=?',[passwordHash,userId]);
  }
  async updateStatusByPublicId(publicId, statusCode, db = this.db) {
    const [result] = await db.execute(
      'UPDATE users SET status_code=? WHERE public_id=? AND deleted_at IS NULL',[statusCode,publicId]
    );
    return result.affectedRows;
  }
  async listAllWithRoles(db = this.db) {
    const [rows]=await db.execute(
      `SELECT u.public_id,u.first_name,u.last_name,u.email,u.status_code,u.last_login_at,u.created_at,
              GROUP_CONCAT(DISTINCT r.code ORDER BY r.code) roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id=u.id
         LEFT JOIN m_roles r ON r.id=ur.role_id
        WHERE u.deleted_at IS NULL
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`
    );
    return rows.map(r=>({...r,roles:r.roles?r.roles.split(','):[]}));
  }
  async getProfile(publicId, db = this.db) {
    return this.findByPublicId(publicId, db);
  }
  async getTeamIds(userId, db = this.db) {
    const [rows]=await db.execute(
      'SELECT team_id FROM team_members WHERE user_id=? AND removed_at IS NULL',[userId]
    );
    return rows.map(r=>r.team_id);
  }
  async getStats(userId, approved, needsCorrection, db = this.db) {
    const [rows]=await db.execute(
      `SELECT COUNT(*) total_reports,
              SUM(status_code=?) approved_reports,
              SUM(status_code=?) needs_correction,
              SUM(first_submitted_at IS NOT NULL) submitted_reports
         FROM weekly_reports WHERE user_id=?`,
      [approved,needsCorrection,userId]
    );
    return rows[0];
  }
  async getReportHistory(userId, db = this.db) {
    const [rows]=await db.execute(
      `SELECT wr.public_id,wr.status_code,rp.week_start,rp.week_end,wr.first_submitted_at,wr.approved_at,
              sc.label status_label
         FROM weekly_reports wr
         JOIN reporting_periods rp ON rp.id=wr.reporting_period_id
         JOIN m_status_codes sc ON sc.code=wr.status_code
        WHERE wr.user_id=? ORDER BY rp.week_start DESC LIMIT 52`,[userId]
    );
    return rows;
  }
}
export const userRepository = new UserRepository();
