import { z } from "zod";
import { StatusCode } from "../../constants/statusCodes.js";
import { Role } from "../../constants/roles.js";

export const userStatusSchema = z.object({
  statusCode: z.union([
    z.literal(StatusCode.ACTIVE),
    z.literal(StatusCode.INACTIVE),
  ]),
});
export const userRolesSchema = z.object({
  roles: z.array(z.enum([Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN])).min(1),
});
export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  teamPublicId: z.string().uuid().nullable().optional(),
  role: z
    .enum([Role.TEAM_MEMBER, Role.MANAGER, Role.ADMIN])
    .default(Role.TEAM_MEMBER),
});
export const userParamsSchema = z.object({ userId: z.string().uuid() });
