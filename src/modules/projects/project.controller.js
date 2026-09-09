import { created, ok } from '../../utils/core.js';
import { projectService } from './project.service.js';
export const projectController={
  list:async(req,res)=>ok(res,await projectService.list(req.user,req.query)),
  create:async(req,res)=>created(res,await projectService.create(req.user,req.body)),
  update:async(req,res)=>ok(res,await projectService.update(req.user,req.params.projectId,req.body)),
  archive:async(req,res)=>ok(res,await projectService.archive(req.user,req.params.projectId)),
  members:async(req,res)=>ok(res,await projectService.members(req.user,req.params.projectId)),
  assignMember:async(req,res)=>ok(res,await projectService.assignMember(req.user,req.params.projectId,req.params.userPublicId)),
  removeMember:async(req,res)=>ok(res,await projectService.removeMember(req.user,req.params.projectId,req.params.userPublicId))
};
