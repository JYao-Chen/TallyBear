import {z} from 'zod';
import {advancePeriod} from './period';

export class CostPlanError extends Error {constructor(message:string){super(message);this.name='CostPlanError';}}
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
const money=z.number().int().nonnegative().max(100000000000);
export const costPlanSchema=z.object({
 title:z.string().trim().min(1).max(120),category:z.string().trim().min(1).max(60),
 familyId:z.string().uuid().nullable().default(null),
 sources:z.array(z.object({transactionId:z.string().uuid(),amount:money.refine(v=>v>0)})).min(1).max(100),
 coverageStart:day,coverageEnd:day,
 mode:z.enum(['monthly','daily','custom']),startMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),months:z.number().int().min(1).max(1200),
 periods:z.array(z.object({start:day,end:day,amount:money})).max(1200).default([]),
 shares:z.array(z.object({userId:z.string().uuid(),amount:money})).min(1).max(50),
 offsets:z.array(z.object({id:z.string().uuid(),transactionId:z.string().uuid().nullable(),userId:z.string().uuid(),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),amount:money.refine(v=>v>0),shared:z.boolean().default(false)})).max(1200).default([]),
});
export type CostPlan=z.infer<typeof costPlanSchema>;
export type CostPeriod={start:string;end:string;amount:number;shares:{userId:string;amount:number}[]};
export type CostRow={month:string;cost:number;offset:number;expected:number;net:number;projected:number};
const sum=(items:number[])=>items.reduce((a,b)=>a+b,0);
const days=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/86400000;
export function distribute(total:number,weights:number[]):number[]{
 if(!Number.isSafeInteger(total)||total<0||!weights.length||weights.some(w=>!Number.isSafeInteger(w)||w<0))throw new CostPlanError('分摊金额无效');
 const all=sum(weights);if(!Number.isSafeInteger(all)||!all){if(total===0)return weights.map(()=>0);throw new CostPlanError('承担比例不能全部为零');}
 const numerators=weights.map(w=>BigInt(total)*BigInt(w));const result=numerators.map(n=>Number(n/BigInt(all)));
 const order=numerators.map((n,i)=>({i,r:n%BigInt(all)})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);
 const remainder=total-sum(result);for(let i=0;i<remainder;i++)result[order[i].i]++;return result;
}
function intersectAmount(amount:number,start:string,end:string,from:string,to:string){
 const n=days(start,end),left=Math.max(0,Math.min(n,days(start,from))),right=Math.max(0,Math.min(n,days(start,to)));
 const cumulative=(x:number)=>Math.floor(amount/n)*x+Math.min(x,amount%n);
 return right<=left?0:cumulative(right)-cumulative(left);
}
export function calculateCostPlan(input:unknown):{plan:CostPlan;periods:CostPeriod[];total:number}{
 const plan=costPlanSchema.parse(input),total=sum(plan.sources.map(s=>s.amount));
 if(!Number.isSafeInteger(total)||total>100000000000)throw new CostPlanError('分摊总额过大');
 if(plan.coverageEnd<=plan.coverageStart)throw new CostPlanError('覆盖结束日期须晚于开始日期');
 if(days(plan.coverageStart,plan.coverageEnd)>366000)throw new CostPlanError('覆盖期间过长');
 if(new Set(plan.sources.map(s=>s.transactionId)).size!==plan.sources.length)throw new CostPlanError('不能重复关联同一付款');
 if(new Set(plan.shares.map(s=>s.userId)).size!==plan.shares.length||sum(plan.shares.map(s=>s.amount))!==total)throw new CostPlanError('各人承担金额之和必须等于原消费金额');
 if(new Set(plan.offsets.map(o=>o.id)).size!==plan.offsets.length)throw new CostPlanError('抵减记录重复');
 if(plan.offsets.some(o=>!plan.shares.some(s=>s.userId===o.userId)))throw new CostPlanError('抵减受益人必须是承担成员');
 let periods:{start:string;end:string;amount:number}[]=[];
 if(plan.mode==='monthly'){
  const parts=distribute(total,Array(plan.months).fill(1));periods=parts.map((amount,i)=>{const start=i?advancePeriod(plan.startMonth+'-01','month',i):plan.startMonth+'-01';return {start,end:advancePeriod(start,'month',1),amount};});
 }else if(plan.mode==='daily'){
  let month=plan.coverageStart.slice(0,7)+'-01';while(month<plan.coverageEnd){const next=advancePeriod(month,'month',1);const start=month<plan.coverageStart?plan.coverageStart:month,end=next>plan.coverageEnd?plan.coverageEnd:next;periods.push({start,end,amount:intersectAmount(total,plan.coverageStart,plan.coverageEnd,start,end)});month=next;}
 }else{
  periods=[...plan.periods].sort((a,b)=>a.start.localeCompare(b.start));
  if(!periods.length||periods.some((p,i)=>p.end<=p.start||(i>0&&p.start<periods[i-1].end))||sum(periods.map(p=>p.amount))!==total)throw new CostPlanError('自定义期间不能重叠，金额合计须等于费用');
 }
 const remaining=[...plan.shares].sort((a,b)=>a.userId.localeCompare(b.userId)).map(s=>({...s}));
 const result=periods.map(p=>{const amounts=distribute(p.amount,remaining.map(s=>s.amount));const shares=remaining.map((s,i)=>{s.amount-=amounts[i];return {userId:s.userId,amount:amounts[i]};});return {...p,shares};});
 return {plan,periods:result,total};
}
/** Range end is inclusive. Daily expansion preserves totals for arbitrary ranges. */
export function costReport(input:unknown,from:string,to:string,userId?:string,sharedOnly=false):CostRow[]{
 day.parse(from);day.parse(to);if(to<from)throw new CostPlanError('结束日期不能早于开始日期');
 if(days(from,to)>36600)throw new CostPlanError('查询期间过长');
 const {plan,periods}=calculateCostPlan(input),rows:CostRow[]=[];
 for(let month=from.slice(0,7)+'-01';month<=to;month=advancePeriod(month,'month',1)){
  const end=advancePeriod(month,'month',1),left=month<from?from:month,right=end>to?advancePeriod(to,'day',1):end;
  const cost=sum(periods.flatMap(p=>p.shares.filter(s=>!userId||s.userId===userId).map(s=>intersectAmount(s.amount,p.start,p.end,left,right))));
  const offsets=plan.offsets.filter(o=>o.month===month.slice(0,7)&&(!userId||o.userId===userId)&&(!sharedOnly||o.shared));
  const offset=sum(offsets.filter(o=>o.transactionId).map(o=>intersectAmount(o.amount,month,end,left,right)));
  const expected=sum(offsets.filter(o=>!o.transactionId).map(o=>intersectAmount(o.amount,month,end,left,right)));
  rows.push({month:month.slice(0,7),cost,offset,expected,net:cost-offset,projected:cost-offset-expected});
 }return rows;
}
