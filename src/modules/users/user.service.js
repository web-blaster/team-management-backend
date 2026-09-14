import { withTransaction } from "../../config/db.js";
import { StatusCode } from "../../constants/statusCodes.js";
import { Role } from "../../constants/roles.js";
import { AppError, randomToken } from "../../utils/core.js";
import {
  assertManagerTeamAccess,
  requireTeamByPublicId,
} from "../teams/team-access.service.js";
import { userRepository } from "./user.repository.js";
import { authService } from "../auth/auth.service.js";
import { roleService } from "../roles/role.service.js";
export class UserService {
  async list() {
    return userRepository.listAllWithRoles();
  }

  async profile(requester, publicId) {
    const user = await userRepository.getProfile(publicId);
    if (!user) throw new AppError(404, "User not found");
    if (!requester.roles.includes(Role.ADMIN)) {
      let allowed = false;
      for (const teamId of await userRepository.getTeamIds(user.id)) {
        try {
          await assertManagerTeamAccess(requester, teamId);
          allowed = true;
          break;
        } catch {}
      }
      if (!allowed) throw new AppError(403, "No shared managed team");
    }
    const [stats, reports] = await Promise.all([
      userRepository.getStats(
        user.id,
        StatusCode.APPROVED,
        StatusCode.NEEDS_CORRECTION,
      ),
      userRepository.getReportHistory(user.id),
    ]);
    const {
      id: _id,
      password_hash: _passwordHash,
      deleted_at: _deletedAt,
      ...safeUser
    } = user;
    return { user: safeUser, stats, reports };
  }

  async changeStatus(publicId, statusCode) {
    if (!(await userRepository.updateStatusByPublicId(publicId, statusCode)))
      throw new AppError(404, "User not found");
    return { updated: true };
  }

  async replaceRoles(publicId, roles, actorId) {
    await withTransaction(async (conn) => {
      const user = await userRepository.findByPublicId(publicId, conn);

      if (!user) {
        throw new AppError(404, "User not found");
      }

      await roleService.replaceUserRoles(user.id, roles, actorId, conn);
    });

    return { updated: true };
  }

  async invite(data, actor) {
    const token = randomToken();

    const invitationId = await withTransaction(async (conn) => {
      let teamId = null;

      if (data.teamPublicId) {
        teamId = (await requireTeamByPublicId(data.teamPublicId, conn)).id;
      }

      const role = await roleService.requireByCode(data.role, conn);

      return authService.createInvitation(
        {
          email: data.email,
          teamId,
          teamPublicId: data.teamPublicId,
          roleId: role.id,
          token,
          actorId: actor.id,
        },
        conn,
      );
    });

    return {
      invitationId,
      developmentToken:
        process.env.NODE_ENV === "production" ? undefined : token,
    };
  }
}
export const userService = new UserService();
