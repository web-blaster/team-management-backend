import { StatusCode } from "../../constants/statusCodes.js";
import { teamRepository } from "./team.repository.js";

export class TeamMembershipService {
  async listActiveForUser(userId, includeAllTeams, db) {
    return teamRepository.listActiveForUser(
      userId,
      includeAllTeams,
      StatusCode.ACTIVE,
      db,
    );
  }

  async addMember(teamId, userId, db) {
    return teamRepository.addMember(teamId, userId, db);
  }
}

export const teamMembershipService = new TeamMembershipService();
