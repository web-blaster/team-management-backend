import { ok } from '../../utils/core.js';
import { lookupService } from './lookup.service.js';
export const lookupController={all:async(_req,res)=>ok(res,await lookupService.getAll())};
