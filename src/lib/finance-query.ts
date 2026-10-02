import {z} from 'zod';

const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'日期无效');
export const financeQuerySchema=z.object({
 from:day,to:day,query:z.string().trim().max(200).default(''),category:z.string().max(60).default(''),
 accountId:z.string().uuid().optional(),activityId:z.string().uuid().optional(),creatorId:z.string().uuid().optional(),
 payee:z.string().max(120).default(''),product:z.string().max(160).default(''),platform:z.string().max(120).default(''),orderId:z.string().max(160).default(''),externalId:z.string().max(160).default(''),
 kind:z.enum(['all','expense','income','refund','transfer','net_expense']).default('all'),
 mode:z.enum(['contains','exact']).default('contains'),basis:z.enum(['period_expense','cashflow']).default('period_expense'),scope:z.enum(['books','personal_wallet']).default('books'),
 min:z.number().int().nonnegative().optional(),max:z.number().int().nonnegative().optional(),offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(30),
}).refine(v=>v.to>=v.from,'结束日期不能早于开始日期').refine(v=>v.min===undefined||v.max===undefined||v.max>=v.min,'最高金额不能低于最低金额');
export type FinanceQuery=z.infer<typeof financeQuerySchema>;
export const financeDimensions=['category','daily_expense','daily_income','weekly_expense','weekly_income','monthly_expense','monthly_income','payee','product','account','platform'] as const;
export type FinanceDimension=typeof financeDimensions[number];
export type FinanceMetric='net_expense'|'income'|'item_amount'|'unit_price'|'quantity';
export function financeQueryParams(query:FinanceQuery){
 const p=new URLSearchParams();for(const [key,value] of Object.entries(query)){if(value===undefined||value==='')continue;const name=({query:'q',accountId:'account',activityId:'activity',creatorId:'creator'} as Record<string,string>)[key]||key;p.set(name,String(value));}return p;
}
export function chartDetailParams(chart:{from:string;to:string;dimension?:string;filters?:FinanceQuery;metric?:FinanceMetric;books?:string[];scope?:string},point:string,offset:number,limit:number){
 const p=chart.filters?financeQueryParams(chart.filters):new URLSearchParams({from:chart.from,to:chart.to});p.set('limit',String(limit));p.set('offset',String(offset));p.set('kind',chart.metric==='income'||chart.dimension?.endsWith('income')?'income':'net_expense');
 chart.books?.forEach(b=>p.append('book',b));if(chart.scope)p.set('scope',chart.scope);if(chart.metric)p.set('metric',chart.metric);
 const grouped:Record<string,string>={category:'category',payee:'payee',product:'product',account:'account',platform:'platform'};
 if(chart.dimension&&grouped[chart.dimension]){p.set('groupField',chart.dimension);p.set('groupValue',point);}
 else{let from=point.length===7?point+'-01':point,to=point.length===7?new Date(Date.UTC(Number(point.slice(0,4)),Number(point.slice(5,7)),0)).toISOString().slice(0,10):point;if(chart.dimension?.startsWith('weekly_'))to=new Date(Date.parse(point)+6*86400000).toISOString().slice(0,10);p.set('from',from>chart.from?from:chart.from);p.set('to',to<chart.to?to:chart.to);}
 return p;
}
