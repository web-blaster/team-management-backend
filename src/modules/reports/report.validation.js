import { z } from 'zod';
import { StatusCode } from '../../constants/statusCodes.js';

const completedTask=z.object({
  taskName:z.string().trim().min(1).max(255),
  projectPublicId:z.string().uuid().nullable().optional(),
  priorityId:z.coerce.number().int().positive(),
  plannedPercent:z.coerce.number().min(0).max(100).nullable().optional(),
  actualPercent:z.coerce.number().min(0).max(100).nullable().optional(),
  statusCode:z.union([
    z.literal(StatusCode.IN_PROGRESS),z.literal(StatusCode.BLOCKED),
    z.literal(StatusCode.DEFERRED),z.literal(StatusCode.COMPLETED)
  ]),
  plannedMinutes:z.coerce.number().int().min(0).max(10080).nullable().optional(),
  spentMinutes:z.coerce.number().int().min(0).max(10080).nullable().optional(),
  deliverable:z.string().trim().max(10000).nullable().optional()
});
const plannedTask=z.object({
  taskName:z.string().trim().min(1).max(255),
  projectPublicId:z.string().uuid().nullable().optional(),
  priorityId:z.coerce.number().int().positive().nullable().optional(),
  plannedMinutes:z.coerce.number().int().min(0).max(10080).nullable().optional(),
  notes:z.string().trim().max(10000).nullable().optional()
});
const blocker=z.object({
  title:z.string().trim().min(1).max(255),
  description:z.string().trim().max(10000).nullable().optional(),
  isKey:z.boolean().default(false),
  isResolved:z.boolean().default(false),
  resolvedAt:z.iso.datetime({offset:true}).nullable().optional()
});
const achievement=z.object({
  title:z.string().trim().min(1).max(255),
  description:z.string().trim().max(10000).nullable().optional(),
  isKey:z.boolean().default(false)
});
export const reportContentSchema=z.object({
  projectPublicIds:z.array(z.string().uuid()).max(50).default([]),
  completedTasks:z.array(completedTask).max(200).default([]),
  plannedTasks:z.array(plannedTask).max(200).default([]),
  blockers:z.array(blocker).max(50).default([]),
  achievements:z.array(achievement).max(50).default([]),
  timeBreakdowns:z.array(z.object({
    taskTypeId:z.coerce.number().int().positive(),
    minutes:z.coerce.number().int().min(0).max(10080)
  })).max(50).default([]),
  notes:z.string().trim().max(20000).nullable().optional(),
  links:z.array(z.object({
    label:z.string().trim().max(255).nullable().optional(),
    url:z.string().url().max(4000)
  })).max(50).default([])
}).superRefine((value,ctx)=>{
  if(value.blockers.filter(x=>x.isKey).length>1)
    ctx.addIssue({code:'custom',message:'Only one blocker can be the key issue',path:['blockers']});
  if(value.achievements.filter(x=>x.isKey).length>1)
    ctx.addIssue({code:'custom',message:'Only one achievement can be the key achievement',path:['achievements']});
  const typeIds=value.timeBreakdowns.map(x=>x.taskTypeId);
  if(new Set(typeIds).size!==typeIds.length)
    ctx.addIssue({code:'custom',message:'Task type time breakdowns must be unique',path:['timeBreakdowns']});
});
export const reportCreateSchema=reportContentSchema.extend({
  teamPublicId:z.string().uuid(),
  reportingPeriodId:z.coerce.number().int().positive()
});
export const reviewSchema=z.object({
  actionCode:z.union([z.literal(StatusCode.APPROVED),z.literal(StatusCode.NEEDS_CORRECTION)]),
  comment:z.string().trim().max(20000).nullable().optional()
}).superRefine((v,ctx)=>{
  if(v.actionCode===StatusCode.NEEDS_CORRECTION&&!v.comment?.trim())
    ctx.addIssue({code:'custom',message:'A correction comment is required',path:['comment']});
});

export const reportParamsSchema=z.object({reportId:z.string().uuid()});
export const reportVersionParamsSchema=reportParamsSchema.extend({versionNo:z.coerce.number().int().positive()});
export const mineQuerySchema=z.object({teamPublicId:z.string().uuid().optional()});
export const teamReportsQuerySchema=z.object({
  teamPublicId:z.string().uuid(),
  reportingPeriodId:z.coerce.number().int().positive().optional(),
  userPublicId:z.string().uuid().optional(),
  projectPublicId:z.string().uuid().optional(),
  statusCode:z.coerce.number().int().refine(value=>[
    StatusCode.DRAFT,StatusCode.SUBMITTED,StatusCode.NEEDS_CORRECTION,StatusCode.APPROVED
  ].includes(value),'Invalid report status').optional(),
  dateFrom:z.iso.date().optional(),
  dateTo:z.iso.date().optional()
}).refine(value=>!value.dateFrom||!value.dateTo||value.dateFrom<=value.dateTo,{
  message:'dateFrom must not be after dateTo',path:['dateFrom']
});
