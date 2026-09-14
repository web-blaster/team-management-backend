import { created, ok } from "../../utils/core.js";
import { teamService } from "./team.service.js";
export const teamController = {
  list: async (req, res) => ok(res, await teamService.list(req.user)),
  create: async (req, res) => created(res, await teamService.create(req.body)),
  update: async (req, res) =>
    ok(res, await teamService.update(req.params.teamId, req.body)),
  remove: async (req, res) =>
    ok(res, await teamService.remove(req.params.teamId)),
  members: async (req, res) =>
    ok(res, await teamService.members(req.user, req.params.teamId)),
  addMember: async (req, res) =>
    ok(
      res,
      await teamService.addMember(
        req.user,
        req.params.teamId,
        req.body.userPublicId,
      ),
    ),
  removeMember: async (req, res) =>
    ok(
      res,
      await teamService.removeMember(
        req.params.teamId,
        req.params.userPublicId,
      ),
    ),
};
