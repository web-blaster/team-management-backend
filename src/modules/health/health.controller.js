import { ok } from '../../utils/core.js';
import { healthService } from './health.service.js';
export const healthController={check:async(_req,res)=>ok(res,await healthService.check())};
