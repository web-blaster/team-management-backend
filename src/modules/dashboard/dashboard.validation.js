import { z } from "zod";

const baseQuery = {
  teamPublicId: z.string().uuid(),
  reportingPeriodId: z.coerce.number().int().positive().optional(),
};

export const dashboardPeriodQuerySchema = z.object(baseQuery);
export const dashboardTeamQuerySchema = z.object({
  teamPublicId: baseQuery.teamPublicId,
});
export const taskTrendQuerySchema = dashboardTeamQuerySchema.extend({
  userPublicId: z.string().uuid().optional(),
});
export const crossTeamQuerySchema = dashboardPeriodQuerySchema.extend({
  section: z.enum(["blockers", "achievements"]).default("blockers"),
});
