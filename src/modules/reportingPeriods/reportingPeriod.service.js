import { StatusCode } from '../../constants/statusCodes.js';
import { AppError } from '../../utils/core.js';
import { assertManagerTeamAccess, assertTeamMember, requireTeamByPublicId } from '../teams/team-access.service.js';
import { reportingPeriodRepository } from './reportingPeriod.repository.js';
export class ReportingPeriodService{
  async list(user,teamPublicId){const team=await requireTeamByPublicId(teamPublicId);await assertTeamMember(user,team.id);return reportingPeriodRepository.listByTeam(team.id);}
  async create(user,data){const team=await requireTeamByPublicId(data.teamPublicId);await assertManagerTeamAccess(user,team.id);
    const id=await reportingPeriodRepository.create({teamId:team.id,weekStart:data.weekStart,weekEnd:data.weekEnd,dueAt:new Date(data.dueAt),statusCode:StatusCode.ACTIVE});
    return {id};
  }
  async close(user,id){const period=await reportingPeriodRepository.findById(id);if(!period)throw new AppError(404,'Reporting period not found');
    await assertManagerTeamAccess(user,period.team_id);await reportingPeriodRepository.close(period.id,StatusCode.COMPLETED);return {closed:true};}
}
export const reportingPeriodService=new ReportingPeriodService();
