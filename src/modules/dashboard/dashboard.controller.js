import { ok } from "../../utils/core.js";
import { dashboardService } from "./dashboard.service.js";
export const dashboardController = {
  summary: async (req, res) =>
    ok(res, await dashboardService.summary(req.user, req.query)),
  memberStatus: async (req, res) =>
    ok(res, await dashboardService.memberStatus(req.user, req.query)),
  taskTrend: async (req, res) =>
    ok(res, await dashboardService.taskTrend(req.user, req.query)),
  projectWorkload: async (req, res) =>
    ok(res, await dashboardService.projectWorkload(req.user, req.query)),
  timeDistribution: async (req, res) =>
    ok(res, await dashboardService.timeDistribution(req.user, req.query)),
  activity: async (req, res) =>
    ok(res, await dashboardService.activity(req.user, req.query)),
  crossTeamSection: async (req, res) =>
    ok(res, await dashboardService.crossTeamSection(req.user, req.query)),
};
