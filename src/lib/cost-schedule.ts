import {z} from 'zod';
import {advancePeriod} from './period';
import {calculateCostPlan} from './cost-attribution';

export const costScheduleSchema=z.object({
 title:z.string().trim().min(1).max(120), category:z.string().trim().min(1).max(60),
 familyId:z.string().uuid().nullable(),
 firstDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),
 months:z.number().int().min(1).max(120),
 totalCycles:z.number().int().min(1).max(120).nullable().optional(),
 shares:z.array(z.object({userId:z.string().uuid(),amount:z.number().int().positive().max(100000000000)})).min(1).max(50),
});
export type CostSchedule=z.infer<typeof costScheduleSchema>;
export function costScheduleProgress(rule:CostSchedule,processed:number){
 const total=rule.totalCycles??null;
 return {processed,totalCycles:total,completed:total!==null&&processed>=total,
  coverageEnd:total===null?null:advancePeriod(rule.firstDate,'month',rule.months*total,Number(rule.firstDate.slice(8)))};
}
// Shares are for one calendar month. Coverage and reporting months are deliberately distinct.
export function scheduledCostPlan(input:unknown,dueDate:string,transactionId:string){
 const s=costScheduleSchema.parse(input);
 return calculateCostPlan({title:s.title,category:s.category,familyId:s.familyId,
  sources:[{transactionId,amount:s.shares.reduce((n,p)=>n+p.amount,0)*s.months}],
  coverageStart:dueDate,coverageEnd:advancePeriod(dueDate,'month',s.months,Number(s.firstDate.slice(8))),
  mode:'monthly',startMonth:dueDate.slice(0,7),months:s.months,periods:[],offsets:[],
  shares:s.shares.map(p=>({...p,amount:p.amount*s.months})),
 }).plan;
}
