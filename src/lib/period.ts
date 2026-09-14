export type PeriodUnit='day'|'week'|'month'|'year';
export const periodLabels:Record<PeriodUnit,string>={day:'天',week:'周',month:'月',year:'年'};
export function advancePeriod(start:string,unit:PeriodUnit,count:number,anchor=Number(start.slice(8))){
 if(!Number.isSafeInteger(count)||count<1)throw new Error('周期数量需为正整数');
 const d=new Date(start+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==start)throw new Error('开始日期无效');
 if(unit==='day'||unit==='week')d.setUTCDate(d.getUTCDate()+count*(unit==='week'?7:1));
 else{d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count*(unit==='year'?12:1));const last=new Date(d.getTime());last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);d.setUTCDate(Math.min(anchor,last.getUTCDate()));}
 if(!Number.isFinite(d.getTime())||d.getUTCFullYear()>9999||d.getUTCFullYear()<1000)throw new Error('周期结束日期超出可记录的日期范围');return d.toISOString().slice(0,10);
}
export function periodShare(total:number,start:string,unit:PeriodUnit,count:number,month:string){
 const end=advancePeriod(start,unit,count),ms=86400000;
 if(!Number.isSafeInteger(total)||total<0)throw new Error('分摊金额无效');
 if(unit==='month'||unit==='year'){const months=count*(unit==='year'?12:1),index=(Number(month.slice(0,4))-Number(start.slice(0,4)))*12+Number(month.slice(5,7))-Number(start.slice(5,7));return index<0||index>=months?0:Math.floor(total/months)+(index<total%months?1:0);}
 const begin=Date.parse(start),finish=Date.parse(end),from=Date.parse(month+'-01'),to=Date.parse(advancePeriod(month+'-01','month',1));
 const days=(finish-begin)/ms,left=Math.max(0,Math.min(days,(from-begin)/ms)),right=Math.max(0,Math.min(days,(to-begin)/ms));
 const cumulative=(n:number)=>Math.floor(total/days)*n+Math.min(n,total%days);return cumulative(right)-cumulative(left);
}
export function periodLastDay(start:string,unit:PeriodUnit,count:number){return new Date(Date.parse(advancePeriod(start,unit,count))-86400000).toISOString().slice(0,10);}
