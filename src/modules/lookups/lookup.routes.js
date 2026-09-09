import { Router } from 'express';
import { authenticate } from '../../middleware/index.js';
import { asyncHandler } from '../../utils/core.js';
import { lookupController } from './lookup.controller.js';
const router=Router();router.use(authenticate);router.get('/',asyncHandler(lookupController.all));export default router;
