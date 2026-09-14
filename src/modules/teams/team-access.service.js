import { Role } from "../../constants/roles.js";
import { AppError } from "../../utils/core.js";
import { teamRepository } from "./team.repository.js";

export const isAdmin = (user) => user.roles.includes(Role.ADMIN);

export async function isActiveTeamMember(teamId, userId, db) {
  return teamRepository.isActiveMember(teamId, userId, db);
}

export async function requireTeamByPublicId(publicId, db) {
  const team = await teamRepository.findByPublicId(publicId, db);
  if (!team) throw new AppError(404, "Team not found");
  return team;
}

export async function assertTeamMember(user, teamId, db) {
  if (isAdmin(user)) return;
  if (!(await isActiveTeamMember(teamId, user.id, db))) {
    throw new AppError(403, "You are not an active member of this team");
  }
}

export async function assertManagerTeamAccess(user, teamId, db) {
  if (isAdmin(user)) return;
  if (!user.roles.includes(Role.MANAGER)) {
    throw new AppError(403, "Manager access required");
  }
  await assertTeamMember(user, teamId, db);
}
