import {advancePeriod} from './period';
export type InstallmentDue={date:string;principal:number;fee:number};
export function installmentSchedule(principal:number,terms:number,firstDate:string,fees=0):InstallmentDue[]{
 if(!Number.isSafeInteger(principal)||principal<1||!Number.isSafeInteger(fees)||fees<0||!Number.isInteger(terms)||terms<1||terms>600)throw new Error('请填写有效本金、费用和1至600期');
 advancePeriod(firstDate,'month',1);
 const split=(n:number,i:number)=>Math.floor(n/terms)+(i<n%terms?1:0);
 return Array.from({length:terms},(_,i)=>({date:i?advancePeriod(firstDate,'month',i):firstDate,principal:split(principal,i),fee:split(fees,i)}));
}
export function remainingPrincipal(principal:number,paid:number,refunded:number){return Math.max(0,principal-paid-refunded);}
export function dueProgress(schedule:InstallmentDue[],covered:number){let left=Math.max(0,covered);return schedule.map(row=>{const applied=Math.min(left,row.principal);left-=applied;return {...row,remaining:row.principal-applied};});}
