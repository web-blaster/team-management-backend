import { Router } from "express";
import { asyncHandler } from "../../utils/core.js";
import { healthController } from "./health.controller.js";
const router = Router();
router.get("/", asyncHandler(healthController.check));
export default router;
