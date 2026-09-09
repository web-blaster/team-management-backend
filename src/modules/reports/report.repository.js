import { pool } from "../../config/db.js";
import { AppError } from "../../utils/core.js";

export async function reportHeaderByPublicId(
  publicId,
  conn = pool,
  forUpdate = false,
) {
  const sql = `
    SELECT wr.*,u.public_id user_public_id,u.first_name,u.last_name,u.email,
           t.public_id team_public_id,t.name team_name,
           rp.week_start,rp.week_end,rp.due_at,
           sc.label status_label,sc.system_key status_key
      FROM weekly_reports wr
      JOIN users u ON u.id=wr.user_id
      JOIN teams t ON t.id=wr.team_id
      JOIN reporting_periods rp ON rp.id=wr.reporting_period_id
      JOIN m_status_codes sc ON sc.code=wr.status_code
     WHERE wr.public_id=? LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`;
  const [rows] = await conn.execute(sql, [publicId]);
  if (!rows[0]) throw new AppError(404, "Report not found");
  return rows[0];
}

export async function versionById(id, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT rv.*,wr.public_id report_public_id
       FROM report_versions rv JOIN weekly_reports wr ON wr.id=rv.report_id
      WHERE rv.id=? LIMIT 1`,
    [id],
  );
  if (!rows[0]) throw new AppError(404, "Report version not found");
  return rows[0];
}

export async function versionContent(versionId, conn = pool) {
  const [
    [versions],
    [projects],
    [completed],
    [planned],
    [blockers],
    [achievements],
    [timeBreakdowns],
    [links],
    [review],
  ] = await Promise.all([
    conn.execute(
      `SELECT rv.version_no,rv.notes,rv.submitted_at,rv.created_at,rv.updated_at
                    FROM report_versions rv WHERE rv.id=?`,
      [versionId],
    ),
    conn.execute(
      `SELECT p.public_id,p.name,p.kind
                    FROM report_version_projects rvp JOIN projects p ON p.id=rvp.project_id
                   WHERE rvp.report_version_id=? ORDER BY p.name`,
      [versionId],
    ),
    conn.execute(
      `SELECT ct.task_name,p.public_id project_public_id,p.name project_name,
                         pr.id priority_id,pr.code priority_code,pr.name priority_name,
                         ct.planned_percent,ct.actual_percent,ct.status_code,sc.label status_label,
                         ct.planned_minutes,ct.spent_minutes,ct.deliverable,ct.sort_order
                    FROM completed_tasks ct
                    LEFT JOIN projects p ON p.id=ct.project_id
                    JOIN m_task_priorities pr ON pr.id=ct.priority_id
                    JOIN m_status_codes sc ON sc.code=ct.status_code
                   WHERE ct.report_version_id=? ORDER BY ct.sort_order,ct.id`,
      [versionId],
    ),
    conn.execute(
      `SELECT pt.task_name,p.public_id project_public_id,p.name project_name,
                         pr.id priority_id,pr.code priority_code,pr.name priority_name,
                         pt.planned_minutes,pt.notes,pt.sort_order
                    FROM planned_tasks pt
                    LEFT JOIN projects p ON p.id=pt.project_id
                    LEFT JOIN m_task_priorities pr ON pr.id=pt.priority_id
                   WHERE pt.report_version_id=? ORDER BY pt.sort_order,pt.id`,
      [versionId],
    ),
    conn.execute(
      `SELECT title,description,is_key,is_resolved,resolved_at,sort_order
                    FROM report_blockers WHERE report_version_id=? ORDER BY sort_order,id`,
      [versionId],
    ),
    conn.execute(
      `SELECT title,description,is_key,sort_order
                    FROM report_achievements WHERE report_version_id=? ORDER BY sort_order,id`,
      [versionId],
    ),
    conn.execute(
      `SELECT rtb.task_type_id,tt.name task_type_name,rtb.minutes
                    FROM report_time_breakdowns rtb
                    JOIN m_task_types tt ON tt.id=rtb.task_type_id
                   WHERE rtb.report_version_id=? ORDER BY tt.name`,
      [versionId],
    ),
    conn.execute(
      `SELECT label,url,sort_order FROM report_links
                   WHERE report_version_id=? ORDER BY sort_order,id`,
      [versionId],
    ),
    conn.execute(
      `SELECT rr.action_code,sc.label action_label,rr.comment,rr.created_at,
                         u.public_id reviewer_public_id,u.first_name reviewer_first_name,u.last_name reviewer_last_name
                    FROM report_reviews rr
                    JOIN m_status_codes sc ON sc.code=rr.action_code
                    JOIN users u ON u.id=rr.reviewer_id
                   WHERE rr.report_version_id=? LIMIT 1`,
      [versionId],
    ),
  ]);
  return {
    ...versions[0],
    projects,
    completedTasks: completed,
    plannedTasks: planned,
    blockers,
    achievements,
    timeBreakdowns,
    links,
    review: review[0] || null,
  };
}

async function projectIdMap(conn, teamId, publicIds = []) {
  const unique = [...new Set(publicIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const placeholders = unique.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT id,public_id FROM projects
      WHERE team_id=? AND status_code=202 AND public_id IN (${placeholders})`,
    [teamId, ...unique],
  );
  if (rows.length !== unique.length)
    throw new AppError(422, "One or more projects do not belong to this team");
  return new Map(rows.map((r) => [r.public_id, r.id]));
}

export async function replaceVersionContent(conn, versionId, teamId, body) {
  const allProjectIds = [
    ...(body.projectPublicIds || []),
    ...(body.completedTasks || []).map((x) => x.projectPublicId),
    ...(body.plannedTasks || []).map((x) => x.projectPublicId),
  ];
  const projects = await projectIdMap(conn, teamId, allProjectIds);

  for (const table of [
    "report_version_projects",
    "completed_tasks",
    "planned_tasks",
    "report_blockers",
    "report_achievements",
    "report_time_breakdowns",
    "report_links",
  ]) {
    await conn.execute(`DELETE FROM ${table} WHERE report_version_id=?`, [
      versionId,
    ]);
  }

  for (const publicId of [...new Set(body.projectPublicIds || [])]) {
    await conn.execute(
      "INSERT INTO report_version_projects (report_version_id,project_id) VALUES (?,?)",
      [versionId, projects.get(publicId)],
    );
  }

  let i = 0;
  for (const task of body.completedTasks || []) {
    await conn.execute(
      `INSERT INTO completed_tasks
       (report_version_id,project_id,task_name,priority_id,planned_percent,actual_percent,status_code,
        planned_minutes,spent_minutes,deliverable,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        versionId,
        task.projectPublicId ? projects.get(task.projectPublicId) : null,
        task.taskName,
        task.priorityId,
        task.plannedPercent ?? null,
        task.actualPercent ?? null,
        task.statusCode,
        task.plannedMinutes ?? null,
        task.spentMinutes ?? null,
        task.deliverable || null,
        i++,
      ],
    );
  }

  i = 0;
  for (const task of body.plannedTasks || []) {
    await conn.execute(
      `INSERT INTO planned_tasks
       (report_version_id,project_id,task_name,priority_id,planned_minutes,notes,sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      [
        versionId,
        task.projectPublicId ? projects.get(task.projectPublicId) : null,
        task.taskName,
        task.priorityId ?? null,
        task.plannedMinutes ?? null,
        task.notes || null,
        i++,
      ],
    );
  }

  i = 0;
  for (const item of body.blockers || []) {
    await conn.execute(
      `INSERT INTO report_blockers
       (report_version_id,title,description,is_key,is_resolved,resolved_at,sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      [
        versionId,
        item.title,
        item.description || null,
        item.isKey ? 1 : 0,
        item.isResolved ? 1 : 0,
        item.isResolved && item.resolvedAt ? new Date(item.resolvedAt) : null,
        i++,
      ],
    );
  }

  i = 0;
  for (const item of body.achievements || []) {
    await conn.execute(
      `INSERT INTO report_achievements
       (report_version_id,title,description,is_key,sort_order)
       VALUES (?,?,?,?,?)`,
      [
        versionId,
        item.title,
        item.description || null,
        item.isKey ? 1 : 0,
        i++,
      ],
    );
  }

  for (const item of body.timeBreakdowns || []) {
    if (item.minutes > 0) {
      await conn.execute(
        "INSERT INTO report_time_breakdowns (report_version_id,task_type_id,minutes) VALUES (?,?,?)",
        [versionId, item.taskTypeId, item.minutes],
      );
    }
  }

  i = 0;
  for (const item of body.links || []) {
    await conn.execute(
      "INSERT INTO report_links (report_version_id,label,url,sort_order) VALUES (?,?,?,?)",
      [versionId, item.label || null, item.url, i++],
    );
  }

  await conn.execute("UPDATE report_versions SET notes=? WHERE id=?", [
    body.notes || null,
    versionId,
  ]);
}

export async function cloneVersion(conn, sourceVersionId, reportId, createdBy) {
  const [versions] = await conn.execute(
    "SELECT COALESCE(MAX(version_no),0)+1 next_no FROM report_versions WHERE report_id=? FOR UPDATE",
    [reportId],
  );
  const [insert] = await conn.execute(
    `INSERT INTO report_versions (report_id,version_no,source_version_id,created_by,notes)
     SELECT ?,?,?,?,notes FROM report_versions WHERE id=?`,
    [
      reportId,
      versions[0].next_no,
      sourceVersionId,
      createdBy,
      sourceVersionId,
    ],
  );
  const target = insert.insertId;

  await conn.execute(
    `INSERT INTO report_version_projects (report_version_id,project_id)
     SELECT ?,project_id FROM report_version_projects WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO completed_tasks
     (report_version_id,project_id,task_name,priority_id,planned_percent,actual_percent,status_code,
      planned_minutes,spent_minutes,deliverable,sort_order)
     SELECT ?,project_id,task_name,priority_id,planned_percent,actual_percent,status_code,
            planned_minutes,spent_minutes,deliverable,sort_order
       FROM completed_tasks WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO planned_tasks
     (report_version_id,project_id,task_name,priority_id,planned_minutes,notes,sort_order)
     SELECT ?,project_id,task_name,priority_id,planned_minutes,notes,sort_order
       FROM planned_tasks WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO report_blockers
     (report_version_id,title,description,is_key,is_resolved,resolved_at,sort_order)
     SELECT ?,title,description,is_key,is_resolved,resolved_at,sort_order
       FROM report_blockers WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO report_achievements
     (report_version_id,title,description,is_key,sort_order)
     SELECT ?,title,description,is_key,sort_order
       FROM report_achievements WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO report_time_breakdowns (report_version_id,task_type_id,minutes)
     SELECT ?,task_type_id,minutes FROM report_time_breakdowns WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  await conn.execute(
    `INSERT INTO report_links (report_version_id,label,url,sort_order)
     SELECT ?,label,url,sort_order FROM report_links WHERE report_version_id=?`,
    [target, sourceVersionId],
  );
  return { id: target, versionNo: versions[0].next_no };
}

export async function findOpenPeriod(
  teamId,
  periodId,
  activeStatus,
  conn = pool,
) {
  const [rows] = await conn.execute(
    "SELECT * FROM reporting_periods WHERE id=? AND team_id=? AND status_code=? LIMIT 1 FOR UPDATE",
    [periodId, teamId, activeStatus],
  );
  return rows[0] ?? null;
}

export async function findExistingReport(
  userId,
  teamId,
  periodId,
  conn = pool,
) {
  const [rows] = await conn.execute(
    "SELECT public_id FROM weekly_reports WHERE user_id=? AND team_id=? AND reporting_period_id=? LIMIT 1",
    [userId, teamId, periodId],
  );
  return rows[0] ?? null;
}

export async function createWeeklyReport(data, conn = pool) {
  const [result] = await conn.execute(
    `INSERT INTO weekly_reports
     (public_id,user_id,team_id,reporting_period_id,status_code)
     VALUES (?,?,?,?,?)`,
    [
      data.publicId,
      data.userId,
      data.teamId,
      data.reportingPeriodId,
      data.statusCode,
    ],
  );
  return result.insertId;
}

export async function createInitialVersion(
  reportId,
  createdBy,
  notes,
  conn = pool,
) {
  const [result] = await conn.execute(
    "INSERT INTO report_versions (report_id,version_no,created_by,notes) VALUES (?,1,?,?)",
    [reportId, createdBy, notes ?? null],
  );
  return result.insertId;
}

export async function setCurrentVersion(reportId, versionId, conn = pool) {
  await conn.execute(
    "UPDATE weekly_reports SET current_version_id=? WHERE id=?",
    [versionId, reportId],
  );
}

export async function addStatusHistory(data, conn = pool) {
  await conn.execute(
    `INSERT INTO report_status_history
     (report_id,report_version_id,from_status_code,to_status_code,changed_by,reason)
     VALUES (?,?,?,?,?,?)`,
    [
      data.reportId,
      data.reportVersionId ?? null,
      data.fromStatusCode ?? null,
      data.toStatusCode,
      data.changedBy,
      data.reason ?? null,
    ],
  );
}

export async function findCurrentVersionForUpdate(
  reportId,
  versionId,
  conn = pool,
) {
  const [rows] = await conn.execute(
    "SELECT * FROM report_versions WHERE id=? AND report_id=? LIMIT 1 FOR UPDATE",
    [versionId, reportId],
  );
  return rows[0] ?? null;
}

export async function markVersionSubmitted(versionId, conn = pool) {
  await conn.execute(
    "UPDATE report_versions SET submitted_at=CURRENT_TIMESTAMP(6) WHERE id=?",
    [versionId],
  );
}

export async function markReportSubmitted(reportId, statusCode, conn = pool) {
  await conn.execute(
    `UPDATE weekly_reports
        SET status_code=?,
            first_submitted_at=COALESCE(first_submitted_at,CURRENT_TIMESTAMP(6)),
            last_submitted_at=CURRENT_TIMESTAMP(6)
      WHERE id=?`,
    [statusCode, reportId],
  );
}

export async function listMine(userId, teamId = null, conn = pool) {
  const params = [userId];
  let teamFilter = "";
  if (teamId) {
    teamFilter = " AND wr.team_id=? ";
    params.push(teamId);
  }
  const [rows] = await conn.execute(
    `SELECT wr.public_id,wr.status_code,sc.label status_label,
            rp.id reporting_period_id,rp.week_start,rp.week_end,rp.due_at,
            wr.first_submitted_at,wr.last_submitted_at,wr.approved_at,
            rv.version_no current_version
       FROM weekly_reports wr
       JOIN reporting_periods rp ON rp.id=wr.reporting_period_id
       JOIN m_status_codes sc ON sc.code=wr.status_code
       LEFT JOIN report_versions rv ON rv.id=wr.current_version_id
      WHERE wr.user_id=? ${teamFilter}
      ORDER BY rp.week_start DESC LIMIT 104`,
    params,
  );
  return rows;
}

export async function listTeam(filters, conn = pool) {
  const {
    teamId,
    reportingPeriodId,
    userPublicId,
    projectPublicId,
    statusCode,
    dateFrom,
    dateTo,
  } = filters;
  const params = [teamId];
  let where = " WHERE wr.team_id=? ";
  if (reportingPeriodId) {
    where += " AND wr.reporting_period_id=? ";
    params.push(Number(reportingPeriodId));
  }
  if (userPublicId) {
    where += " AND u.public_id=? ";
    params.push(userPublicId);
  }
  if (statusCode) {
    where += " AND wr.status_code=? ";
    params.push(Number(statusCode));
  }
  if (dateFrom) {
    where += " AND rp.week_start>=? ";
    params.push(dateFrom);
  }
  if (dateTo) {
    where += " AND rp.week_end<=? ";
    params.push(dateTo);
  }
  if (projectPublicId) {
    where += ` AND EXISTS (
      SELECT 1 FROM report_version_projects rvp
      JOIN projects fp ON fp.id=rvp.project_id
      WHERE rvp.report_version_id=wr.current_version_id AND fp.public_id=?
    ) `;
    params.push(projectPublicId);
  }
  const [rows] = await conn.execute(
    `SELECT wr.public_id,wr.status_code,sc.label status_label,
            u.public_id user_public_id,u.first_name,u.last_name,
            rp.id reporting_period_id,rp.week_start,rp.week_end,rp.due_at,
            wr.first_submitted_at,wr.last_submitted_at,wr.approved_at,
            rv.version_no current_version
       FROM weekly_reports wr
       JOIN users u ON u.id=wr.user_id
       JOIN reporting_periods rp ON rp.id=wr.reporting_period_id
       JOIN m_status_codes sc ON sc.code=wr.status_code
       LEFT JOIN report_versions rv ON rv.id=wr.current_version_id
       ${where}
      ORDER BY rp.week_start DESC,u.first_name,u.last_name LIMIT 1000`,
    params,
  );
  return rows;
}

export async function listVersions(reportId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT rv.version_no,rv.submitted_at,rv.created_at,
            rr.action_code,sc.label review_action,rr.comment,rr.created_at reviewed_at,
            u.first_name reviewer_first_name,u.last_name reviewer_last_name
       FROM report_versions rv
       LEFT JOIN report_reviews rr ON rr.report_version_id=rv.id
       LEFT JOIN m_status_codes sc ON sc.code=rr.action_code
       LEFT JOIN users u ON u.id=rr.reviewer_id
      WHERE rv.report_id=? ORDER BY rv.version_no DESC`,
    [reportId],
  );
  return rows;
}

export async function findVersionIdByNumber(reportId, versionNo, conn = pool) {
  const [rows] = await conn.execute(
    "SELECT id FROM report_versions WHERE report_id=? AND version_no=? LIMIT 1",
    [reportId, Number(versionNo)],
  );
  return rows[0]?.id ?? null;
}

export async function createReview(data, conn = pool) {
  const [result] = await conn.execute(
    "INSERT INTO report_reviews (report_id,report_version_id,reviewer_id,action_code,comment) VALUES (?,?,?,?,?)",
    [
      data.reportId,
      data.reportVersionId,
      data.reviewerId,
      data.actionCode,
      data.comment ?? null,
    ],
  );
  return result.insertId;
}

export async function approveReport(reportId, statusCode, conn = pool) {
  await conn.execute(
    "UPDATE weekly_reports SET status_code=?,approved_at=CURRENT_TIMESTAMP(6) WHERE id=?",
    [statusCode, reportId],
  );
}

export async function requestCorrection(
  reportId,
  statusCode,
  newVersionId,
  conn = pool,
) {
  await conn.execute(
    "UPDATE weekly_reports SET status_code=?,current_version_id=?,approved_at=NULL WHERE id=?",
    [statusCode, newVersionId, reportId],
  );
}
