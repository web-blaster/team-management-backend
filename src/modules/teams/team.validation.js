import { z } from 'zod';
export const teamCreateSchema=z.object({
  name:z.string().trim().min(2).max(150),
  description:z.string().trim().max(5000).optional().nullable()
});
export const teamUpdateSchema=teamCreateSchema.partial().refine(
  (data)=>Object.keys(data).length>0,
  {message:'Provide a team name or description to update'}
);
export const teamMemberSchema=z.object({userPublicId:z.string().uuid()});
export const teamParamsSchema=z.object({teamId:z.string().uuid()});
export const teamMemberParamsSchema=teamParamsSchema.extend({userPublicId:z.string().uuid()});
