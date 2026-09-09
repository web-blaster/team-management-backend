import { AppError } from "../../utils/core.js";
import {
  assertManagerTeamAccess,
  getTeamByPublicId,
} from "../../services/access.service.js";
import { reportingPeriodRepository } from "../reportingPeriods/reportingPeriod.repository.js";
import { dashboardRepository } from "./dashboard.repository.js";

async function resolvePeriod(teamId, id) {
  const period = id
    ? await reportingPeriodRepository.findByIdAndTeam(id, teamId)
    : await reportingPeriodRepository.findNearest(teamId);
  if (!period)
    throw new AppError(
      404,
      id ? "Reporting period not found" : "No reporting period configured",
    );
  return period;
}
async function context(user, query) {
  const team = await getTeamByPublicId(query.teamPublicId);
  await assertManagerTeamAccess(user, team.id);
  const period = await resolvePeriod(team.id, query.reportingPeriodId ?? null);
  return { team, period };
}

export class DashboardService {
  async summary(user, query) {
    const { team, period } = await context(user, query);
    const [totalMembers, r, openBlockers] = await Promise.all([
      dashboardRepository.memberCount(team.id),
      dashboardRepository.reportSummary(team.id, period),
      dashboardRepository.openBlockerCount(team.id, period.id),
    ]);
    const everSubmitted = Number(r.ever_submitted || 0);
    return {
      period,
      totalMembers,
      reportsStarted: Number(r.reports_started || 0),
      totalSubmitted: everSubmitted,
      submittedNow: Number(r.submitted_now || 0),
      needsCorrection: Number(r.needs_correction || 0),
      approved: Number(r.approved || 0),
      onTime: Number(r.on_time || 0),
      late: Number(r.late || 0),
      pending: Math.max(totalMembers - everSubmitted, 0),
      complianceRate: totalMembers
        ? Number(((everSubmitted / totalMembers) * 100).toFixed(2))
        : 0,
      openBlockers,
    };
  }
  async memberStatus(user, query) {
    const { team, period } = await context(user, query);
    return {
      period,
      rows: await dashboardRepository.memberStatus(team.id, period.id),
    };
  }
  async taskTrend(user, query) {
    const team = await getTeamByPublicId(query.teamPublicId);
    await assertManagerTeamAccess(user, team.id);
    return dashboardRepository.taskTrend(team.id, query.userPublicId);
  }
  async projectWorkload(user, query) {
    const { team, period } = await context(user, query);
    return {
      period,
      rows: await dashboardRepository.projectWorkload(team.id, period.id),
    };
  }
  async timeDistribution(user, query) {
    const { team, period } = await context(user, query);
    return {
      period,
      rows: await dashboardRepository.timeDistribution(team.id, period.id),
    };
  }
  async activity(user, query) {
    const team = await getTeamByPublicId(query.teamPublicId);
    await assertManagerTeamAccess(user, team.id);
    return dashboardRepository.recentActivity(team.id);
  }
  async crossTeamSection(user, query) {
    const { team, period } = await context(user, query);
    return {
      period,
      section: query.section,
      rows: await dashboardRepository.crossTeamSection(
        team.id,
        period.id,
        query.section,
      ),
    };
  }
}
export const dashboardService = new DashboardService();
