import { withTransaction } from '../../config/db.js';
import { Role } from '../../constants/roles.js';
import { StatusCode } from '../../constants/statusCodes.js';
import { AppError, uuid } from '../../utils/core.js';
import { assertManagerTeamAccess, getTeamByPublicId } from '../../services/access.service.js';
import { activity } from '../../services/audit.service.js';
import { userRepository } from '../users/user.repository.js';
import { teamRepository } from './team.repository.js';

export class TeamService {
  async list(user){return teamRepository.listForUser(user.id,user.roles.includes(Role.ADMIN),StatusCode.ACTIVE,StatusCode.ARCHIVED);}
  async create(data){
    const publicId=uuid();
    await teamRepository.create({publicId,name:data.name,description:data.description,statusCode:StatusCode.ACTIVE});
    return {publicId,name:data.name};
  }
  async members(user,teamPublicId){
    const team=await getTeamByPublicId(teamPublicId); await assertManagerTeamAccess(user,team.id);
    return teamRepository.listMembers(team.id);
  }
  async addMember(actor,teamPublicId,userPublicId){
    const team=await getTeamByPublicId(teamPublicId);
    const user=await userRepository.findByPublicId(userPublicId); if(!user)throw new AppError(404,'User not found');
    await withTransaction(async conn=>{
      const membership=await teamRepository.findMembership(team.id,user.id,conn);
      if(membership)await teamRepository.restoreMembership(membership.id,conn);
      else await teamRepository.addMember(team.id,user.id,conn);
      await activity(conn,{teamId:team.id,actorUserId:actor.id,eventType:'TEAM_MEMBER_ADDED',entityType:'USER',entityId:user.id});
    });
    return {added:true};
  }
  async removeMember(teamPublicId,userPublicId){
    const team=await getTeamByPublicId(teamPublicId);
    const user=await userRepository.findByPublicId(userPublicId);if(!user)throw new AppError(404,'User not found');
    await teamRepository.removeMember(team.id,user.id);
    return {removed:true};
  }
}
export const teamService=new TeamService();
