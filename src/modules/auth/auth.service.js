import bcrypt from 'bcryptjs';
import { withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { StatusCode } from '../../constants/statusCodes.js';
import { Role } from '../../constants/roles.js';
import { AppError, encryptSecret, randomToken, sha256, signAccessToken, uuid } from '../../utils/core.js';
import { userRepository } from '../users/user.repository.js';
import { roleRepository } from '../roles/role.repository.js';
import { teamRepository } from '../teams/team.repository.js';
import { authRepository } from './auth.repository.js';
import { activity, outbox } from '../../services/audit.service.js';

function publicUser(user,roles){
  return {publicId:user.public_id,firstName:user.first_name,lastName:user.last_name,email:user.email,roles};
}
async function issueSession(user,context,db){
  const roles=await roleRepository.getUserRoleCodes(user.id,db);
  const refreshToken=randomToken();
  const expiresAt=new Date(Date.now()+env.REFRESH_TOKEN_DAYS*86400000);
  await authRepository.createSession({
    publicId:uuid(),userId:user.id,refreshTokenHash:sha256(refreshToken),
    ipAddress:context.ip,userAgent:context.userAgent?.slice(0,500)||null,expiresAt
  },db);
  return {accessToken:signAccessToken({...user,roles}),refreshToken,user:publicUser(user,roles)};
}

export class AuthService {
  async register(data,context){
    const user=await withTransaction(async conn=>{
      if(await userRepository.findByEmail(data.email,conn))throw new AppError(409,'Email is already registered');
      const role=await roleRepository.findByCode(Role.TEAM_MEMBER,conn);
      if(!role)throw new AppError(500,'TEAM_MEMBER role seed is missing');
      const created=await userRepository.create({
        publicId:uuid(),firstName:data.firstName,lastName:data.lastName,email:data.email,
        passwordHash:await bcrypt.hash(data.password,12),statusCode:StatusCode.ACTIVE
      },conn);
      await roleRepository.assign(created.id,role.id,null,conn);
      return created;
    });
    return issueSession(user,context);
  }

  async login(data,context){
    const user=await userRepository.findByEmail(data.email);
    if(!user||!(await bcrypt.compare(data.password,user.password_hash)))
      throw new AppError(401,'Invalid email or password');
    if(user.status_code!==StatusCode.ACTIVE)throw new AppError(403,'Account is not active');
    await userRepository.updateLastLogin(user.id);
    return issueSession(user,context);
  }

  async refresh(refreshToken,context){
    if(!refreshToken)throw new AppError(401,'Refresh session is missing');
    return withTransaction(async conn=>{
      const session=await authRepository.findRefreshSessionForUpdate(sha256(refreshToken),conn);
      if(!session||new Date(session.expires_at).getTime()<=Date.now())
        throw new AppError(401,'Refresh session is invalid or expired');
      if(session.status_code!==StatusCode.ACTIVE)throw new AppError(403,'Account is not active');
      await authRepository.revokeSession(session.id,conn);
      const user={id:session.user_id,public_id:session.public_id,first_name:session.first_name,last_name:session.last_name,email:session.email};
      return issueSession(user,context,conn);
    });
  }

  async logout(refreshToken){
    if(refreshToken)await authRepository.revokeByTokenHash(sha256(refreshToken));
    return {loggedOut:true};
  }

  async forgotPassword(email){
    const user=await userRepository.findActiveByEmail(email,StatusCode.ACTIVE);
    if(user){
      const token=randomToken();
      await withTransaction(async conn=>{
        await authRepository.invalidateOpenPasswordResets(user.id,conn);
        const id=await authRepository.createPasswordReset(user.id,sha256(token),conn);
        await outbox(conn,{aggregateType:'PASSWORD_RESET',aggregateId:id,eventType:'user.password_reset.requested',
          payload:{email:user.email,tokenCipher:encryptSecret(token)}});
      });
    }
    return {accepted:true};
  }

  async resetPassword(token,password){
    return withTransaction(async conn=>{
      const reset=await authRepository.findPasswordResetForUpdate(sha256(token),StatusCode.ACTIVE,conn);
      if(!reset)throw new AppError(400,'Password reset token is invalid or expired');
      await userRepository.updatePassword(reset.user_id,await bcrypt.hash(password,12),conn);
      await authRepository.markPasswordResetUsed(reset.id,conn);
      await authRepository.revokeAllForUser(reset.user_id,conn);
      return {reset:true};
    });
  }

  async changePassword(userId,currentPassword,newPassword){
    const user=await userRepository.findById(userId);
    if(!user||!(await bcrypt.compare(currentPassword,user.password_hash)))
      throw new AppError(400,'Current password is incorrect');
    await withTransaction(async conn=>{
      await userRepository.updatePassword(userId,await bcrypt.hash(newPassword,12),conn);
      await authRepository.revokeAllForUser(userId,conn);
    });
    return {changed:true,reauthenticate:true};
  }

  async me(user){
    const teams=await teamRepository.listActiveForUser(
      user.id,user.roles.includes(Role.ADMIN),StatusCode.ACTIVE
    );
    return {publicId:user.public_id,firstName:user.first_name,lastName:user.last_name,email:user.email,roles:user.roles,teams};
  }

  async acceptInvitation(data,context){
    const user=await withTransaction(async conn=>{
      const invite=await authRepository.findInvitationForUpdate(sha256(data.token),StatusCode.PENDING,conn);
      if(!invite)throw new AppError(400,'Invitation is invalid or expired');
      if(await userRepository.findByEmail(invite.email,conn))
        throw new AppError(409,'An account already exists for this email');
      const created=await userRepository.create({
        publicId:uuid(),firstName:data.firstName,lastName:data.lastName,email:invite.email,
        passwordHash:await bcrypt.hash(data.password,12),statusCode:StatusCode.ACTIVE,emailVerifiedAt:new Date()
      },conn);
      let roleId=invite.role_id;
      if(!roleId){
        const role=await roleRepository.findByCode(Role.TEAM_MEMBER,conn);
        roleId=role.id;
      }
      await roleRepository.assign(created.id,roleId,invite.invited_by,conn);
      if(invite.team_id)await teamRepository.addMember(invite.team_id,created.id,conn);
      await authRepository.acceptInvitation(invite.id,StatusCode.ACCEPTED,conn);
      await activity(conn,{teamId:invite.team_id,actorUserId:created.id,eventType:'USER_INVITATION_ACCEPTED',entityType:'USER',entityId:created.id});
      await outbox(conn,{aggregateType:'USER',aggregateId:created.id,eventType:'user.invitation.accepted',
        payload:{userPublicId:created.public_id,email:invite.email}});
      return created;
    });
    return issueSession(user,context);
  }

  async resolveAuthenticatedUser(payload){
    const user=await userRepository.findAuthUser(payload.uid,payload.sub);
    if(!user||user.status_code!==StatusCode.ACTIVE)throw new AppError(401,'Account is not active');
    user.roles=await roleRepository.getUserRoleCodes(user.id);
    return user;
  }
}
export const authService=new AuthService();
