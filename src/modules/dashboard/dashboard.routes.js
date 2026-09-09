import { Router } from "express";
import { Role } from "../../constants/roles.js";
import { authenticate, authorize, validate } from "../../middleware/index.js";
import { asyncHandler } from "../../utils/core.js";
import { dashboardController } from "./dashboard.controller.js";
import {
  crossTeamQuerySchema,
  dashboardPeriodQuerySchema,
  dashboardTeamQuerySchema,
  taskTrendQuerySchema,
} from "./dashboard.validation.js";
const router = Router();
router.use(authenticate, authorize(Role.MANAGER, Role.ADMIN));
router.get(
  "/summary",
  validate(dashboardPeriodQuerySchema, "query"),
  asyncHandler(dashboardController.summary),
);
router.get(
  "/member-status",
  validate(dashboardPeriodQuerySchema, "query"),
  asyncHandler(dashboardController.memberStatus),
);
router.get(
  "/task-trend",
  validate(taskTrendQuerySchema, "query"),
  asyncHandler(dashboardController.taskTrend),
);
router.get(
  "/project-workload",
  validate(dashboardPeriodQuerySchema, "query"),
  asyncHandler(dashboardController.projectWorkload),
);
router.get(
  "/time-distribution",
  validate(dashboardPeriodQuerySchema, "query"),
  asyncHandler(dashboardController.timeDistribution),
);
router.get(
  "/activity",
  validate(dashboardTeamQuerySchema, "query"),
  asyncHandler(dashboardController.activity),
);
router.get(
  "/cross-team-section",
  validate(crossTeamQuerySchema, "query"),
  asyncHandler(dashboardController.crossTeamSection),
);
export default router;
