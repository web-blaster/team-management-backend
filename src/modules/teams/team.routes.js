import { Router } from "express";
import { Role } from "../../constants/roles.js";
import { authenticate, authorize, validate } from "../../middleware/index.js";
import { asyncHandler } from "../../utils/core.js";
import { teamController } from "./team.controller.js";
import {
  teamCreateSchema,
  teamUpdateSchema,
  teamMemberParamsSchema,
  teamMemberSchema,
  teamParamsSchema,
} from "./team.validation.js";
const router = Router();
router.use(authenticate);
router.get("/", asyncHandler(teamController.list));
router.post(
  "/",
  authorize(Role.ADMIN),
  validate(teamCreateSchema),
  asyncHandler(teamController.create),
);
router.patch(
  "/:teamId",
  authorize(Role.ADMIN),
  validate(teamParamsSchema, "params"),
  validate(teamUpdateSchema),
  asyncHandler(teamController.update),
);
router.delete(
  "/:teamId",
  authorize(Role.ADMIN),
  validate(teamParamsSchema, "params"),
  asyncHandler(teamController.remove),
);
router.get(
  "/:teamId/members",
  validate(teamParamsSchema, "params"),
  asyncHandler(teamController.members),
);
router.post(
  "/:teamId/members",
  authorize(Role.ADMIN),
  validate(teamParamsSchema, "params"),
  validate(teamMemberSchema),
  asyncHandler(teamController.addMember),
);
router.delete(
  "/:teamId/members/:userPublicId",
  authorize(Role.ADMIN),
  validate(teamMemberParamsSchema, "params"),
  asyncHandler(teamController.removeMember),
);
export default router;
