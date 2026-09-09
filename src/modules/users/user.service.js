import { withTransaction } from '../../config/db.js';
import { StatusCode } from '../../constants/statusCodes.js';
import { Role } from '../../constants/roles.js';
import { AppError, encryptSecret, randomToken, sha256 } from '../../utils/core.js';
import { assertManagerTeamAccess, getTeamByPublicId } from '../../services/access.service.js';
import { activity, outbox } from '../../services/audit.service.js';
import { userRepository } from './user.repository.js';
import { roleRepository } from '../roles/role.repository.js';
import { authRepository } from '../auth/auth.repository.js';

export class UserService {
  async list(){ return userRepository.listAllWithRoles(); }

  async profile(requester,publicId){
    const user=await userRepository.getProfile(publicId);
    if(!user)throw new AppError(404,'User not found');
    if(!requester.roles.includes(Role.ADMIN)){
      let allowed=false;
      for(const teamId of await userRepository.getTeamIds(user.id)){
        try{await assertManagerTeamAccess(requester,teamId);allowed=true;break;}catch{}
      }
      if(!allowed)throw new AppError(403,'No shared managed team');
    }
    const [stats,reports]=await Promise.all([
      userRepository.getStats(user.id,StatusCode.APPROVED,StatusCode.NEEDS_CORRECTION),
      userRepository.getReportHistory(user.id)
    ]);
    const {id:_id,password_hash:_passwordHash,deleted_at:_deletedAt,...safeUser}=user;
    return {user:safeUser,stats,reports};
  }

  async changeStatus(publicId,statusCode){
    if(!(await userRepository.updateStatusByPublicId(publicId,statusCode)))
      throw new AppError(404,'User not found');
    return {updated:true};
  }

  async replaceRoles(publicId,roles,actorId){
    const user=await userRepository.findByPublicId(publicId);
    if(!user)throw new AppError(404,'User not found');
    await withTransaction(conn=>roleRepository.replaceUserRoles(user.id,roles,actorId,conn));
    return {updated:true};
  }

  async invite(data,actor){
    const token=randomToken();
    const invitationId=await withTransaction(async conn=>{
      let teamId=null;
      if(data.teamPublicId)teamId=(await getTeamByPublicId(data.teamPublicId,conn)).id;
      const role=await roleRepository.findByCode(data.role,conn);
      if(!role)throw new AppError(422,'Role not found');
      const id=await authRepository.createInvitation({
        email:data.email,teamId,roleId:role.id,tokenHash:sha256(token),
        invitedBy:actor.id,statusCode:StatusCode.PENDING
      },conn);
      await activity(conn,{teamId,actorUserId:actor.id,eventType:'USER_INVITED',entityType:'USER_INVITATION',entityId:id,metadata:{email:data.email}});
      await outbox(conn,{aggregateType:'USER_INVITATION',aggregateId:id,eventType:'user.invited',
        payload:{email:data.email,tokenCipher:encryptSecret(token),teamPublicId:data.teamPublicId||null}});
      return id;
    });
    return {invitationId,developmentToken:process.env.NODE_ENV==='production'?undefined:token};
  }
}
export const userService=new UserService();
