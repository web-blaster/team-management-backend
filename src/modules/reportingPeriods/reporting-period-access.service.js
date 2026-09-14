import { AppError } from "../../utils/core.js";
import { reportingPeriodRepository } from "./reportingPeriod.repository.js";

export async function requireReportingPeriodForTeam(teamId, id, db) {
  const period = id
    ? await reportingPeriodRepository.findByIdAndTeam(id, teamId, db)
    : await reportingPeriodRepository.findNearest(teamId, db);

  if (!period) {
    throw new AppError(
      404,
      id ? "Reporting period not found" : "No reporting period configured",
    );
  }

  return period;
}
