import { withTransaction } from "../../config/db.js";
import { Role } from "../../constants/roles.js";
import { StatusCode } from "../../constants/statusCodes.js";
import { AppError, uuid } from "../../utils/core.js";
import {
  assertManagerTeamAccess,
  requireTeamByPublicId,
} from "./team-access.service.js";
import { activity } from "../../services/audit.service.js";
import { userAccessService } from "../users/user-access.service.js";
import { teamRepository } from "./team.repository.js";

export class TeamService {
  async list(user) {
    return teamRepository.listForUser(
      user.id,
      user.roles.includes(Role.ADMIN),
      StatusCode.ACTIVE,
      StatusCode.ARCHIVED,
    );
  }
  async create(data) {
    const team = {
      publicId: uuid(),
      name: data.name,
      description: data.description ?? null,
      statusCode: StatusCode.ACTIVE,
    };
    await teamRepository.create(team);
    return team;
  }
  async update(publicId, changes) {
    return withTransaction(async (conn) => {
      const team = await teamRepository.findByPublicId(publicId, conn, true);
      if (!team) throw new AppError(404, "Team not found");
      await teamRepository.update(team.id, changes, conn);
      return {
        publicId: team.public_id,
        name: changes.name ?? team.name,
        description:
          changes.description !== undefined
            ? changes.description
            : team.description,
        statusCode: team.status_code,
      };
    });
  }
  async remove(publicId) {
    return withTransaction(async (conn) => {
      // Lock the parent before checking dependencies so a concurrent child insert
      // cannot slip between the check and a cascading delete.
      const team = await teamRepository.findByPublicId(publicId, conn, true);
      if (!team) throw new AppError(404, "Team not found");
      if (await teamRepository.hasRelatedRecords(team.id, conn)) {
        throw new AppError(
          409,
          "This team has members or related records and cannot be deleted.",
        );
      }
      try {
        await teamRepository.remove(team.id, conn);
      } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
          throw new AppError(
            409,
            "This team has related records and cannot be deleted.",
          );
        }
        throw error;
      }
      return { deleted: true };
    });
  }
  async members(user, teamPublicId) {
    const team = await requireTeamByPublicId(teamPublicId);
    await assertManagerTeamAccess(user, team.id);
    return teamRepository.listMembers(team.id);
  }
  async addMember(actor, teamPublicId, userPublicId) {
    const team = await requireTeamByPublicId(teamPublicId);
    const user = await userAccessService.requireByPublicId(userPublicId);
    await withTransaction(async (conn) => {
      const membership = await teamRepository.findMembership(
        team.id,
        user.id,
        conn,
      );
      if (membership)
        await teamRepository.restoreMembership(membership.id, conn);
      else await teamRepository.addMember(team.id, user.id, conn);
      await activity(conn, {
        teamId: team.id,
        actorUserId: actor.id,
        eventType: "TEAM_MEMBER_ADDED",
        entityType: "USER",
        entityId: user.id,
      });
    });
    return { added: true };
  }
  async removeMember(teamPublicId, userPublicId) {
    const team = await requireTeamByPublicId(teamPublicId);
    const user = await userAccessService.requireByPublicId(userPublicId);
    await teamRepository.removeMember(team.id, user.id);
    return { removed: true };
  }
}
export const teamService = new TeamService();
