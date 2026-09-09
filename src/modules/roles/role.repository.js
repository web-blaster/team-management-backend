import { pool } from '../../config/db.js';

export class RoleRepository {
  constructor(db = pool) { this.db = db; }
  async findByCode(code, db = this.db) {
    const [rows]=await db.execute('SELECT id,code,name FROM m_roles WHERE code=? LIMIT 1',[code]);
    return rows[0] ?? null;
  }
  async list(db = this.db) {
    const [rows]=await db.execute('SELECT id,code,name FROM m_roles ORDER BY id');
    return rows;
  }
  async getUserRoleCodes(userId, db = this.db) {
    const [rows]=await db.execute(
      `SELECT r.code FROM user_roles ur JOIN m_roles r ON r.id=ur.role_id WHERE ur.user_id=?`,[userId]
    );
    return rows.map(r=>r.code);
  }
  async assign(userId, roleId, assignedBy = null, db = this.db) {
    await db.execute(
      'INSERT INTO user_roles (user_id,role_id,assigned_by) VALUES (?,?,?)',[userId,roleId,assignedBy]
    );
  }
  async replaceUserRoles(userId, roleCodes, assignedBy, db = this.db) {
    const roles=await this.list(db);
    const map=new Map(roles.map(r=>[r.code,r.id]));
    await db.execute('DELETE FROM user_roles WHERE user_id=?',[userId]);
    for(const code of [...new Set(roleCodes)]) {
      const roleId=map.get(code);
      if(!roleId) throw new Error(`Unknown role code: ${code}`);
      await this.assign(userId,roleId,assignedBy,db);
    }
  }
}
export const roleRepository = new RoleRepository();
