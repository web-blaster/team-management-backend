import { created, ok } from '../../utils/core.js';
import { reportingPeriodService } from './reportingPeriod.service.js';
export const reportingPeriodController={
  list:async(req,res)=>ok(res,await reportingPeriodService.list(req.user,req.query.teamPublicId)),
  create:async(req,res)=>created(res,await reportingPeriodService.create(req.user,req.body)),
  close:async(req,res)=>ok(res,await reportingPeriodService.close(req.user,req.params.id))
};
