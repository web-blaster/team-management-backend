import { pool } from '../../config/db.js';

export class AuthRepository {
  constructor(db = pool) { this.db = db; }
  async createSession(data, db = this.db) {
    const [result]=await db.execute(
      `INSERT INTO auth_sessions
       (public_id,user_id,refresh_token_hash,ip_address,user_agent,expires_at)
       VALUES (?,?,?,?,?,?)`,
      [data.publicId,data.userId,data.refreshTokenHash,data.ipAddress,data.userAgent,data.expiresAt]
    );
    return result.insertId;
  }
  async findRefreshSessionForUpdate(hash, db = this.db) {
    const [rows]=await db.execute(
      `SELECT s.id,s.user_id,s.expires_at,u.public_id,u.first_name,u.last_name,u.email,u.status_code
         FROM auth_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.refresh_token_hash=? AND s.revoked_at IS NULL
        LIMIT 1 FOR UPDATE`,[hash]
    );
    return rows[0] ?? null;
  }
  async revokeSession(sessionId, db = this.db) {
    await db.execute(
      'UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP(6),last_used_at=CURRENT_TIMESTAMP(6) WHERE id=?',
      [sessionId]
    );
  }
  async revokeByTokenHash(hash, db = this.db) {
    await db.execute(
      'UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP(6)) WHERE refresh_token_hash=?',[hash]
    );
  }
  async revokeAllForUser(userId, db = this.db) {
    await db.execute(
      'UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP(6)) WHERE user_id=?',[userId]
    );
  }
  async invalidateOpenPasswordResets(userId, db = this.db) {
    await db.execute(
      'UPDATE password_reset_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP(6)) WHERE user_id=? AND used_at IS NULL',
      [userId]
    );
  }
  async createPasswordReset(userId, tokenHash, db = this.db) {
    const [result]=await db.execute(
      `INSERT INTO password_reset_tokens (user_id,token_hash,expires_at)
       VALUES (?,?,DATE_ADD(CURRENT_TIMESTAMP(6),INTERVAL 30 MINUTE))`,
      [userId,tokenHash]
    );
    return result.insertId;
  }
  async findPasswordResetForUpdate(tokenHash, activeStatus, db = this.db) {
    const [rows]=await db.execute(
      `SELECT prt.id,prt.user_id
         FROM password_reset_tokens prt JOIN users u ON u.id=prt.user_id
        WHERE prt.token_hash=? AND prt.used_at IS NULL AND prt.expires_at>CURRENT_TIMESTAMP(6)
          AND u.status_code=? AND u.deleted_at IS NULL
        LIMIT 1 FOR UPDATE`,
      [tokenHash,activeStatus]
    );
    return rows[0] ?? null;
  }
  async markPasswordResetUsed(id, db = this.db) {
    await db.execute('UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP(6) WHERE id=?',[id]);
  }
  async findInvitationForUpdate(tokenHash, pendingStatus, db = this.db) {
    const [rows]=await db.execute(
      `SELECT * FROM user_invitations
        WHERE token_hash=? AND status_code=? AND expires_at>CURRENT_TIMESTAMP(6)
        LIMIT 1 FOR UPDATE`,[tokenHash,pendingStatus]
    );
    return rows[0] ?? null;
  }
  async acceptInvitation(id, acceptedStatus, db = this.db) {
    await db.execute(
      'UPDATE user_invitations SET status_code=?,accepted_at=CURRENT_TIMESTAMP(6) WHERE id=?',[acceptedStatus,id]
    );
  }
  async createInvitation(data, db = this.db) {
    const [result]=await db.execute(
      `INSERT INTO user_invitations (email,team_id,role_id,token_hash,invited_by,status_code,expires_at)
       VALUES (?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP(6),INTERVAL 7 DAY))`,
      [data.email,data.teamId,data.roleId,data.tokenHash,data.invitedBy,data.statusCode]
    );
    return result.insertId;
  }
}
export const authRepository = new AuthRepository();
