import { z } from 'zod';

const name=z.string().trim().min(2).max(150);
const kind=z.enum(['PROJECT','CATEGORY']);
const description=z.string().trim().max(5000).optional().nullable();

export const projectBodySchema=z.object({
  teamPublicId:z.string().uuid(),
  name,
  kind:kind.default('PROJECT'),
  description
});
export const projectUpdateSchema=z.object({name:name.optional(),kind:kind.optional(),description}).refine(
  value=>Object.keys(value).length>0,{message:'At least one field is required'}
);
export const projectListQuerySchema=z.object({
  teamPublicId:z.string().uuid(),
  status:z.enum(['active','all']).default('active')
});
export const projectParamsSchema=z.object({projectId:z.string().uuid()});
export const projectMemberParamsSchema=projectParamsSchema.extend({userPublicId:z.string().uuid()});
