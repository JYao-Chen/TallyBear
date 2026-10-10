import {detailSort,sortDetails} from './detail-sort';
export type FundEvent={id:string;date:string;createdAt?:string;occurredAt?:string;kind:'income'|'expense'|'refund'|'transfer'|'adjustment';amount:number;sourceId:string|null;targetId:string|null;title:string;counterparty:string;sourceName:string;targetName:string;note:string;origin:'transaction'|'family'|'adjustment';bookId?:string;reference?:string;costTitle?:string};
export type FundRow=FundEvent&{inflow:number;outflow:number;delta:number;internal:boolean};
export function fundRowsPage(rows:FundRow[],params:URLSearchParams){
 const query=(params.get('q')||'').trim().toLowerCase(),flow=params.get('flow')||'all';
 const filtered=rows.filter(r=>(!query||[r.title,r.costTitle,r.counterparty,r.sourceName,r.targetName,r.note,r.reference,r.date].join(' ').toLowerCase().includes(query))&&(flow==='all'||flow==='in'&&r.inflow>0||flow==='out'&&r.outflow>0||flow==='transfer'&&r.kind==='transfer'&&!r.internal||flow==='internal'&&r.internal||flow==='adjustment'&&r.kind==='adjustment'));
 const offset=Math.max(0,Number(params.get('offset'))||0),limit=20;
 return {rows:sortDetails(filtered,detailSort(params.get('sort')),r=>({date:r.date,time:r.occurredAt,created:r.createdAt,amount:r.amount,id:r.id})).slice(offset,offset+limit),count:filtered.length,offset,hasMore:offset+limit<filtered.length};
}
export type FundsData=Omit<ReturnType<typeof summarizeWalletFunds>,'rows'>&ReturnType<typeof fundRowsPage>;
export function summarizeWalletFunds(events:FundEvent[],accounts:{id:string;opening:number}[],from:string,to:string){
 const owned=new Set(accounts.map(a=>a.id));let opening=accounts.reduce((n,a)=>n+Number(a.opening),0);
 const summary={income:0,expense:0,refund:0,transferIn:0,transferOut:0,internalTransfer:0,adjustment:0,inflow:0,outflow:0,flowChange:0,balanceChange:0,openingBalance:0,closingBalance:0};
 const rows:FundRow[]=[],daily=new Map<string,{date:string;inflow:number;outflow:number;adjustment:number;delta:number}>();
 for(const e of events){const source=!!e.sourceId&&owned.has(e.sourceId),target=!!e.targetId&&owned.has(e.targetId);if(!source&&!target||e.date>to)continue;
  const internal=e.kind==='transfer'&&source&&target;
  const delta=e.kind==='adjustment'?(source?e.amount:0):e.kind==='income'||e.kind==='refund'?(source?e.amount:0):(target?e.amount:0)-(source?e.amount:0);
  if(e.date<from){opening+=delta;continue;}
  const inflow=e.kind==='adjustment'||internal?0:Math.max(0,delta),outflow=e.kind==='adjustment'||internal?0:Math.max(0,-delta);
  rows.push({...e,inflow,outflow,delta,internal});
  if(e.kind==='transfer'){if(internal)summary.internalTransfer+=e.amount;else{summary.transferIn+=inflow;summary.transferOut+=outflow;}}
  else if(e.kind==='adjustment')summary.adjustment+=delta;
  else summary[e.kind]+=e.amount;
  summary.inflow+=inflow;summary.outflow+=outflow;
  const d=daily.get(e.date)||{date:e.date,inflow:0,outflow:0,adjustment:0,delta:0};d.inflow+=inflow;d.outflow+=outflow;d.delta+=delta;if(e.kind==='adjustment')d.adjustment+=delta;daily.set(e.date,d);
 }
 summary.flowChange=summary.inflow-summary.outflow;summary.balanceChange=summary.flowChange+summary.adjustment;summary.openingBalance=opening;summary.closingBalance=opening+summary.balanceChange;
 return {summary,daily:[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)),rows:rows.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))};
}
