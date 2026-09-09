import { withTransaction } from "../../config/db.js";
import { Role } from "../../constants/roles.js";
import {
  StatusCode,
  editableReportStatuses,
} from "../../constants/statusCodes.js";
import { AppError, uuid } from "../../utils/core.js";
import {
  assertManagerTeamAccess,
  assertTeamMember,
  getTeamByPublicId,
} from "../../services/access.service.js";
import { activity, outbox } from "../../services/audit.service.js";
import * as repo from "./report.repository.js";

async function assertCanRead(user, report) {
  if (report.user_id === user.id) return;
  if (report.status_code === StatusCode.DRAFT)
    throw new AppError(403, "Draft report content is private");
  await assertManagerTeamAccess(user, report.team_id);
}

function publicReportHeader(report) {
  const {
    id: _id,
    user_id: _userId,
    team_id: _teamId,
    reporting_period_id: _periodId,
    current_version_id: _currentVersionId,
    deleted_at: _deletedAt,
    ...publicReport
  } = report;
  return publicReport;
}

export class ReportService {
  async create(user, data) {
    const team = await getTeamByPublicId(data.teamPublicId);
    await assertTeamMember(user, team.id);
    return withTransaction(async (conn) => {
      const period = await repo.findOpenPeriod(
        team.id,
        data.reportingPeriodId,
        StatusCode.ACTIVE,
        conn,
      );
      if (!period)
        throw new AppError(422, "Reporting period is not open for this team");
      const existing = await repo.findExistingReport(
        user.id,
        team.id,
        period.id,
        conn,
      );
      if (existing)
        throw new AppError(409, "A report already exists for this week", {
          reportPublicId: existing.public_id,
        });
      const publicId = uuid();
      const reportId = await repo.createWeeklyReport(
        {
          publicId,
          userId: user.id,
          teamId: team.id,
          reportingPeriodId: period.id,
          statusCode: StatusCode.DRAFT,
        },
        conn,
      );
      const versionId = await repo.createInitialVersion(
        reportId,
        user.id,
        data.notes,
        conn,
      );
      await repo.replaceVersionContent(conn, versionId, team.id, data);
      await repo.setCurrentVersion(reportId, versionId, conn);
      await repo.addStatusHistory(
        {
          reportId,
          reportVersionId: versionId,
          toStatusCode: StatusCode.DRAFT,
          changedBy: user.id,
        },
        conn,
      );
      await activity(conn, {
        teamId: team.id,
        actorUserId: user.id,
        eventType: "REPORT_CREATED",
        entityType: "WEEKLY_REPORT",
        entityId: reportId,
      });
      return { publicId, versionId };
    });
  }

  async update(user, reportPublicId, data) {
    await withTransaction(async (conn) => {
      const report = await repo.reportHeaderByPublicId(
        reportPublicId,
        conn,
        true,
      );
      if (report.user_id !== user.id)
        throw new AppError(403, "You may edit only your own report");
      if (!editableReportStatuses.has(report.status_code))
        throw new AppError(409, "Report is not editable in its current status");
      const version = await repo.findCurrentVersionForUpdate(
        report.id,
        report.current_version_id,
        conn,
      );
      if (!version)
        throw new AppError(409, "Current report version is missing");
      if (version.submitted_at)
        throw new AppError(409, "Submitted versions are immutable");
      await repo.replaceVersionContent(conn, version.id, report.team_id, data);
      await activity(conn, {
        teamId: report.team_id,
        actorUserId: user.id,
        eventType: "REPORT_DRAFT_UPDATED",
        entityType: "WEEKLY_REPORT",
        entityId: report.id,
        metadata: { version: version.version_no },
      });
    });
    return { updated: true };
  }

  async submit(user, reportPublicId) {
    return withTransaction(async (conn) => {
      const report = await repo.reportHeaderByPublicId(
        reportPublicId,
        conn,
        true,
      );
      if (report.user_id !== user.id)
        throw new AppError(403, "You may submit only your own report");
      if (!editableReportStatuses.has(report.status_code))
        throw new AppError(
          409,
          "Report cannot be submitted in its current status",
        );
      const version = await repo.findCurrentVersionForUpdate(
        report.id,
        report.current_version_id,
        conn,
      );
      if (!version || version.submitted_at)
        throw new AppError(
          409,
          "Current version is already submitted or invalid",
        );
      const previous = report.status_code;
      await repo.markVersionSubmitted(version.id, conn);
      await repo.markReportSubmitted(report.id, StatusCode.SUBMITTED, conn);
      await repo.addStatusHistory(
        {
          reportId: report.id,
          reportVersionId: version.id,
          fromStatusCode: previous,
          toStatusCode: StatusCode.SUBMITTED,
          changedBy: user.id,
        },
        conn,
      );
      const eventType =
        previous === StatusCode.NEEDS_CORRECTION
          ? "REPORT_RESUBMITTED"
          : "REPORT_SUBMITTED";
      await activity(conn, {
        teamId: report.team_id,
        actorUserId: user.id,
        eventType,
        entityType: "WEEKLY_REPORT",
        entityId: report.id,
        metadata: { version: version.version_no },
      });
      await outbox(conn, {
        aggregateType: "WEEKLY_REPORT",
        aggregateId: report.id,
        eventType: eventType.toLowerCase().replaceAll("_", "."),
        payload: {
          reportPublicId: report.public_id,
          version: version.version_no,
          teamPublicId: report.team_public_id,
          userPublicId: report.user_public_id,
        },
      });
      return { statusCode: StatusCode.SUBMITTED, version: version.version_no };
    });
  }

  async mine(user, { teamPublicId }) {
    let teamId = null;
    if (teamPublicId) {
      const team = await getTeamByPublicId(teamPublicId);
      await assertTeamMember(user, team.id);
      teamId = team.id;
    }
    return repo.listMine(user.id, teamId);
  }

  async teamReports(user, filters) {
    const team = await getTeamByPublicId(filters.teamPublicId);
    await assertManagerTeamAccess(user, team.id);
    return repo.listTeam({ ...filters, teamId: team.id });
  }

  async versions(user, publicId) {
    const report = await repo.reportHeaderByPublicId(publicId);
    await assertCanRead(user, report);
    return repo.listVersions(report.id);
  }

  async version(user, publicId, versionNo) {
    const report = await repo.reportHeaderByPublicId(publicId);
    await assertCanRead(user, report);
    const id = await repo.findVersionIdByNumber(report.id, versionNo);
    if (!id) throw new AppError(404, "Version not found");
    return {
      report: publicReportHeader(report),
      version: await repo.versionContent(id),
    };
  }

  async detail(user, publicId) {
    const report = await repo.reportHeaderByPublicId(publicId);
    await assertCanRead(user, report);
    return {
      report: publicReportHeader(report),
      version: report.current_version_id
        ? await repo.versionContent(report.current_version_id)
        : null,
    };
  }

  async review(user, publicId, data) {
    return withTransaction(async (conn) => {
      const report = await repo.reportHeaderByPublicId(publicId, conn, true);
      await assertManagerTeamAccess(user, report.team_id, conn);
      if (report.user_id === user.id && !user.roles.includes(Role.ADMIN))
        throw new AppError(403, "Managers cannot review their own report");
      if (report.status_code !== StatusCode.SUBMITTED)
        throw new AppError(409, "Only submitted reports can be reviewed");
      const version = await repo.findCurrentVersionForUpdate(
        report.id,
        report.current_version_id,
        conn,
      );
      if (!version?.submitted_at)
        throw new AppError(409, "Current version has not been submitted");
      await repo.createReview(
        {
          reportId: report.id,
          reportVersionId: version.id,
          reviewerId: user.id,
          actionCode: data.actionCode,
          comment: data.comment,
        },
        conn,
      );
      let newVersion = null;
      if (data.actionCode === StatusCode.APPROVED) {
        await repo.approveReport(report.id, StatusCode.APPROVED, conn);
      } else {
        newVersion = await repo.cloneVersion(
          conn,
          version.id,
          report.id,
          report.user_id,
        );
        await repo.requestCorrection(
          report.id,
          StatusCode.NEEDS_CORRECTION,
          newVersion.id,
          conn,
        );
      }
      await repo.addStatusHistory(
        {
          reportId: report.id,
          reportVersionId: version.id,
          fromStatusCode: StatusCode.SUBMITTED,
          toStatusCode: data.actionCode,
          changedBy: user.id,
          reason: data.comment,
        },
        conn,
      );
      const eventType =
        data.actionCode === StatusCode.APPROVED
          ? "REPORT_APPROVED"
          : "REPORT_CHANGES_REQUESTED";
      await activity(conn, {
        teamId: report.team_id,
        actorUserId: user.id,
        eventType,
        entityType: "WEEKLY_REPORT",
        entityId: report.id,
        metadata: {
          reviewedVersion: version.version_no,
          newVersion: newVersion?.versionNo || null,
        },
      });
      await outbox(conn, {
        aggregateType: "WEEKLY_REPORT",
        aggregateId: report.id,
        eventType: eventType.toLowerCase().replaceAll("_", "."),
        payload: {
          reportPublicId: report.public_id,
          reviewedVersion: version.version_no,
          comment: data.comment || null,
        },
      });
      return {
        statusCode: data.actionCode,
        newEditableVersion: newVersion?.versionNo || null,
      };
    });
  }
}
export const reportService = new ReportService();
