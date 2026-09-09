import { z } from 'zod';
export const teamCreateSchema=z.object({
  name:z.string().trim().min(2).max(150),
  description:z.string().trim().max(5000).optional().nullable()
});
export const teamMemberSchema=z.object({userPublicId:z.string().uuid()});
export const teamParamsSchema=z.object({teamId:z.string().uuid()});
export const teamMemberParamsSchema=teamParamsSchema.extend({userPublicId:z.string().uuid()});
