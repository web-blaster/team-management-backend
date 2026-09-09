import { pool } from '../../config/db.js';

export class ReportingPeriodRepository {
  constructor(db=pool){this.db=db;}
  async listByTeam(teamId,db=this.db){
    const [rows]=await db.execute(
      `SELECT id,week_start,week_end,due_at,status_code
         FROM reporting_periods WHERE team_id=? ORDER BY week_start DESC LIMIT 104`,[teamId]
    );
    return rows;
  }
  async findById(id,db=this.db){
    const [rows]=await db.execute('SELECT * FROM reporting_periods WHERE id=? LIMIT 1',[id]);
    return rows[0] ?? null;
  }
  async findByIdAndTeam(id,teamId,db=this.db,forUpdate=false){
    const [rows]=await db.execute(
      `SELECT * FROM reporting_periods WHERE id=? AND team_id=? LIMIT 1 ${forUpdate?'FOR UPDATE':''}`,
      [id,teamId]
    );
    return rows[0] ?? null;
  }
  async findNearest(teamId,db=this.db){
    const [rows]=await db.execute(
      `SELECT * FROM reporting_periods WHERE team_id=?
       ORDER BY ABS(DATEDIFF(CURRENT_DATE(),week_end)),week_start DESC LIMIT 1`,[teamId]
    );
    return rows[0] ?? null;
  }
  async create(data,db=this.db){
    const [result]=await db.execute(
      `INSERT INTO reporting_periods (team_id,week_start,week_end,due_at,status_code)
       VALUES (?,?,?,?,?)`,
      [data.teamId,data.weekStart,data.weekEnd,data.dueAt,data.statusCode]
    );
    return result.insertId;
  }
  async close(id,statusCode,db=this.db){
    const [result]=await db.execute('UPDATE reporting_periods SET status_code=? WHERE id=?',[statusCode,id]);
    return result.affectedRows;
  }
}
export const reportingPeriodRepository=new ReportingPeriodRepository();
