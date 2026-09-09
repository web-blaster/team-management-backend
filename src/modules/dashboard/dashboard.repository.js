import { pool } from "../../config/db.js";
import { StatusCode } from "../../constants/statusCodes.js";

export class DashboardRepository {
  constructor(db = pool) {
    this.db = db;
  }
  async memberCount(teamId, db = this.db) {
    const [rows] = await db.execute(
      "SELECT COUNT(*) total FROM team_members WHERE team_id=? AND removed_at IS NULL",
      [teamId],
    );
    return Number(rows[0]?.total || 0);
  }
  async reportSummary(teamId, period, db = this.db) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) reports_started,
              SUM(first_submitted_at IS NOT NULL) ever_submitted,
              SUM(status_code=?) submitted_now,
              SUM(status_code=?) needs_correction,
              SUM(status_code=?) approved,
              SUM(first_submitted_at IS NOT NULL AND first_submitted_at<=?) on_time,
              SUM(first_submitted_at IS NOT NULL AND first_submitted_at>?) late
         FROM weekly_reports WHERE team_id=? AND reporting_period_id=?`,
      [
        StatusCode.SUBMITTED,
        StatusCode.NEEDS_CORRECTION,
        StatusCode.APPROVED,
        period.due_at,
        period.due_at,
        teamId,
        period.id,
      ],
    );
    return rows[0] || {};
  }
  async openBlockerCount(teamId, periodId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) open_blockers
         FROM weekly_reports wr JOIN report_blockers rb ON rb.report_version_id=wr.current_version_id
        WHERE wr.team_id=? AND wr.reporting_period_id=? AND wr.status_code<>? AND rb.is_resolved=0`,
      [teamId, periodId, StatusCode.DRAFT],
    );
    return Number(rows[0]?.open_blockers || 0);
  }
  async memberStatus(teamId, periodId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT u.public_id user_public_id,u.first_name,u.last_name,
              wr.public_id report_public_id,wr.status_code,
              COALESCE(sc.label,'Not Started') status_label,
              wr.first_submitted_at,
              CASE WHEN wr.id IS NULL THEN 'NOT_STARTED'
                   WHEN wr.first_submitted_at IS NULL THEN 'PENDING'
                   WHEN wr.first_submitted_at<=rp.due_at THEN 'ON_TIME'
                   ELSE 'LATE' END compliance
         FROM team_members tm
         JOIN users u ON u.id=tm.user_id AND u.deleted_at IS NULL
         JOIN reporting_periods rp ON rp.id=? AND rp.team_id=tm.team_id
         LEFT JOIN weekly_reports wr ON wr.user_id=u.id AND wr.team_id=tm.team_id AND wr.reporting_period_id=rp.id
         LEFT JOIN m_status_codes sc ON sc.code=wr.status_code
        WHERE tm.team_id=? AND tm.removed_at IS NULL ORDER BY u.first_name,u.last_name`,
      [periodId, teamId],
    );
    return rows;
  }
  async taskTrend(teamId, userPublicId = null, db = this.db) {
    const params = [
      StatusCode.COMPLETED,
      teamId,
      StatusCode.APPROVED,
      StatusCode.SUBMITTED,
      StatusCode.NEEDS_CORRECTION,
    ];
    let userFilter = "";
    if (userPublicId) {
      userFilter = " AND u.public_id=? ";
      params.push(userPublicId);
    }
    const [rows] = await db.execute(
      `SELECT rp.week_start,COUNT(ct.id) tasks,SUM(ct.status_code=?) completed_tasks
         FROM weekly_reports wr
         JOIN reporting_periods rp ON rp.id=wr.reporting_period_id
         JOIN users u ON u.id=wr.user_id
         LEFT JOIN completed_tasks ct ON ct.report_version_id=wr.current_version_id
        WHERE wr.team_id=? AND wr.status_code IN (?,?,?) ${userFilter}
        GROUP BY rp.id,rp.week_start ORDER BY rp.week_start DESC LIMIT 16`,
      params,
    );
    return rows.reverse();
  }
  async projectWorkload(teamId, periodId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT p.public_id,p.name,p.kind,COUNT(ct.id) task_count,COALESCE(SUM(ct.spent_minutes),0) spent_minutes
         FROM weekly_reports wr JOIN completed_tasks ct ON ct.report_version_id=wr.current_version_id
         JOIN projects p ON p.id=ct.project_id
        WHERE wr.team_id=? AND wr.reporting_period_id=? AND wr.status_code<>?
        GROUP BY p.id,p.public_id,p.name,p.kind ORDER BY spent_minutes DESC,p.name`,
      [teamId, periodId, StatusCode.DRAFT],
    );
    return rows;
  }
  async timeDistribution(teamId, periodId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT tt.id task_type_id,tt.name,COALESCE(SUM(rtb.minutes),0) minutes
         FROM weekly_reports wr JOIN report_time_breakdowns rtb ON rtb.report_version_id=wr.current_version_id
         JOIN m_task_types tt ON tt.id=rtb.task_type_id
        WHERE wr.team_id=? AND wr.reporting_period_id=? AND wr.status_code<>?
        GROUP BY tt.id,tt.name ORDER BY minutes DESC`,
      [teamId, periodId, StatusCode.DRAFT],
    );
    return rows;
  }
  async recentActivity(teamId, db = this.db) {
    const [rows] = await db.execute(
      `SELECT al.id,al.event_type,al.entity_type,al.entity_id,al.metadata,al.created_at,
              u.public_id actor_public_id,u.first_name,u.last_name
         FROM activity_logs al LEFT JOIN users u ON u.id=al.actor_user_id
        WHERE al.team_id=? ORDER BY al.created_at DESC LIMIT 50`,
      [teamId],
    );
    return rows;
  }
  async crossTeamSection(teamId, periodId, section, db = this.db) {
    const sql =
      section === "achievements"
        ? `SELECT u.public_id user_public_id,u.first_name,u.last_name,ra.title,ra.description,ra.is_key
           FROM weekly_reports wr JOIN users u ON u.id=wr.user_id
           JOIN report_achievements ra ON ra.report_version_id=wr.current_version_id
          WHERE wr.team_id=? AND wr.reporting_period_id=? AND wr.status_code<>? ORDER BY u.first_name,ra.sort_order`
        : `SELECT u.public_id user_public_id,u.first_name,u.last_name,rb.title,rb.description,rb.is_key,rb.is_resolved
           FROM weekly_reports wr JOIN users u ON u.id=wr.user_id
           JOIN report_blockers rb ON rb.report_version_id=wr.current_version_id
          WHERE wr.team_id=? AND wr.reporting_period_id=? AND wr.status_code<>? ORDER BY u.first_name,rb.sort_order`;
    const [rows] = await db.execute(sql, [teamId, periodId, StatusCode.DRAFT]);
    return rows;
  }
}
export const dashboardRepository = new DashboardRepository();
