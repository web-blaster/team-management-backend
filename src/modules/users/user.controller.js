import { created, ok } from "../../utils/core.js";
import { userService } from "./user.service.js";

export const userController = {
  list: async (_req, res) => ok(res, await userService.list()),
  profile: async (req, res) =>
    ok(res, await userService.profile(req.user, req.params.userId)),
  changeStatus: async (req, res) =>
    ok(
      res,
      await userService.changeStatus(req.params.userId, req.body.statusCode),
    ),
  replaceRoles: async (req, res) =>
    ok(
      res,
      await userService.replaceRoles(
        req.params.userId,
        req.body.roles,
        req.user.id,
      ),
    ),
  invite: async (req, res) =>
    created(res, await userService.invite(req.body, req.user)),
};
