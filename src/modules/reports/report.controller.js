import { created, ok } from '../../utils/core.js';
import { reportService } from './report.service.js';
export const reportController={
  create:async(req,res)=>created(res,await reportService.create(req.user,req.body)),
  update:async(req,res)=>ok(res,await reportService.update(req.user,req.params.reportId,req.body)),
  submit:async(req,res)=>ok(res,await reportService.submit(req.user,req.params.reportId)),
  mine:async(req,res)=>ok(res,await reportService.mine(req.user,req.query)),
  team:async(req,res)=>ok(res,await reportService.teamReports(req.user,req.query)),
  versions:async(req,res)=>ok(res,await reportService.versions(req.user,req.params.reportId)),
  version:async(req,res)=>ok(res,await reportService.version(req.user,req.params.reportId,req.params.versionNo)),
  detail:async(req,res)=>ok(res,await reportService.detail(req.user,req.params.reportId)),
  review:async(req,res)=>ok(res,await reportService.review(req.user,req.params.reportId,req.body))
};
