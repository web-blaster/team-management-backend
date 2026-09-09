import { z } from 'zod';
export const periodCreateSchema=z.object({
  teamPublicId:z.string().uuid(),
  weekStart:z.iso.date(),
  weekEnd:z.iso.date(),
  dueAt:z.iso.datetime({offset:true})
});
export const periodListQuerySchema=z.object({teamPublicId:z.string().uuid()});
export const periodParamsSchema=z.object({id:z.coerce.number().int().positive()});
