import {verifyItemTotal,type LineItem} from '@/lib/line-items';
type Order={kind:string;amount:number;date:string;payee:string;accountId:string;orderId:string;externalId?:string;platform:string;lineItems:LineItem[];note:string};
function sameOrder(a:Order,b:Order){
 if(a.kind!==b.kind||a.amount!==b.amount)return false;
 if(a.accountId&&b.accountId&&a.accountId!==b.accountId)return false;
 if(a.date&&b.date&&a.date!==b.date)return false;
 if(a.orderId&&b.orderId&&a.orderId!==b.orderId)return false;
 if(a.externalId&&b.externalId)return a.externalId===b.externalId;
 if(a.orderId&&b.orderId)return a.orderId===b.orderId&&(!a.platform||!b.platform||a.platform===b.platform);
 return !!a.payee&&a.payee===b.payee&&!!a.date&&a.date===b.date;
}
export async function verifyAndRepair<T extends Order>(entries:T[],reread:(faults:T[],attempt:number)=>Promise<T[]>,stage:(message:string)=>void=()=>{},signal?:AbortSignal){
 let result=[...entries],repaired=0,attempts=0;
 const failed=(entry:T)=>['mismatch','incomplete'].includes(verifyItemTotal(entry.lineItems,entry.amount).status);
 for(let attempt=1;attempt<=2;attempt++){
  const faults=result.filter(failed);if(!faults.length)break;
  signal?.throwIfAborted();attempts=attempt;stage(`金额核验：${faults.length} 笔明细待核对，正在重新识别原图（第 ${attempt}/2 次）`);
  let candidates:T[];try{candidates=await reread(faults,attempt);}catch(error){signal?.throwIfAborted();continue;}
  result=result.map(entry=>{
   if(!failed(entry))return entry;
   const matches=candidates.filter(candidate=>sameOrder(entry,candidate));
   if(matches.length!==1||result.filter(other=>sameOrder(other,matches[0])).length!==1)return entry;
   const candidate=matches[0];if(verifyItemTotal(candidate.lineItems,entry.amount).status!=='verified')return entry;
   repaired++;return {...entry,lineItems:candidate.lineItems,note:[entry.note,'明细金额已重新识别核验，与实付一致'].filter(Boolean).join('；').slice(0,2000)};
  });
 }
 const unresolved=result.filter(failed).length;
 result=result.map(entry=>{const check=verifyItemTotal(entry.lineItems,entry.amount);return failed(entry)?{...entry,note:[entry.note,check.missing?`金额核验待处理：${check.missing}项缺少小计`:`金额核验未通过：实付与明细相差${(check.difference/100).toFixed(2)}元`].filter(Boolean).join('；').slice(0,2000)}:entry;});
 return {entries:result,repaired,unresolved,attempts};
}
