import { withTransaction } from '../../config/db.js';
import { StatusCode } from '../../constants/statusCodes.js';
import { AppError, uuid } from '../../utils/core.js';
import { assertManagerTeamAccess, assertTeamMember, getTeamByPublicId } from '../../services/access.service.js';
import { activity, outbox } from '../../services/audit.service.js';
import { userRepository } from '../users/user.repository.js';
import { teamRepository } from '../teams/team.repository.js';
import { projectRepository } from './project.repository.js';

export class ProjectService{
  async list(user,{teamPublicId,status='active'}){
    const team=await getTeamByPublicId(teamPublicId);
    await assertTeamMember(user,team.id);
    return projectRepository.list({teamId:team.id,statusCode:status==='active'?StatusCode.ACTIVE:null});
  }
  async create(user,data){
    const team=await getTeamByPublicId(data.teamPublicId);await assertManagerTeamAccess(user,team.id);
    const publicId=uuid();
    await withTransaction(async conn=>{
      const id=await projectRepository.create({
        publicId,teamId:team.id,name:data.name,kind:data.kind,description:data.description,
        statusCode:StatusCode.ACTIVE,createdBy:user.id
      },conn);
      await activity(conn,{teamId:team.id,actorUserId:user.id,eventType:'PROJECT_CREATED',entityType:'PROJECT',entityId:id});
      await outbox(conn,{aggregateType:'PROJECT',aggregateId:id,eventType:'project.created',payload:{publicId,name:data.name,kind:data.kind}});
    });
    return {publicId};
  }
  async update(user,publicId,changes){
    const project=await projectRepository.findByPublicId(publicId);if(!project)throw new AppError(404,'Project not found');
    await assertManagerTeamAccess(user,project.team_id);
    await projectRepository.update(project.id,changes);
    return {updated:true};
  }
  async archive(user,publicId){
    const project=await projectRepository.findByPublicId(publicId);if(!project)throw new AppError(404,'Project not found');
    await assertManagerTeamAccess(user,project.team_id);
    await projectRepository.archive(project.id,StatusCode.ARCHIVED);
    return {archived:true};
  }
  async members(user,publicId){
    const project=await projectRepository.findByPublicId(publicId);if(!project)throw new AppError(404,'Project not found');
    await assertManagerTeamAccess(user,project.team_id);
    return projectRepository.listMembers(project.id);
  }
  async assignMember(user,projectPublicId,userPublicId){
    const project=await projectRepository.findByPublicId(projectPublicId);if(!project)throw new AppError(404,'Project not found');
    await assertManagerTeamAccess(user,project.team_id);
    const member=await userRepository.findByPublicId(userPublicId);if(!member)throw new AppError(404,'User not found');
    if(!(await teamRepository.isActiveMember(project.team_id,member.id)))throw new AppError(422,'User must belong to the project team');
    const membership=await projectRepository.findMembership(project.id,member.id);
    if(membership)await projectRepository.restoreMembership(membership.id); else await projectRepository.addMember(project.id,member.id);
    return {assigned:true};
  }
  async removeMember(user,projectPublicId,userPublicId){
    const project=await projectRepository.findByPublicId(projectPublicId);if(!project)throw new AppError(404,'Project not found');
    await assertManagerTeamAccess(user,project.team_id);
    const member=await userRepository.findByPublicId(userPublicId);if(!member)throw new AppError(404,'User not found');
    await projectRepository.removeMember(project.id,member.id);
    return {removed:true};
  }
}
export const projectService=new ProjectService();
