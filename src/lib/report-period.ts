export type ReportRange={from:string;to:string};
export type ReportPeriod='year'|'month'|'week'|'day'|'custom';
export function periodRange(period:Exclude<ReportPeriod,'custom'>,anchor:string):ReportRange{
 const date=new Date(anchor+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(anchor)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==anchor)throw new Error('请选择有效日期');
 const year=date.getUTCFullYear(),month=date.getUTCMonth();
 const format=(d:Date)=>d.toISOString().slice(0,10);
 if(period==='year')return {from:`${year}-01-01`,to:`${year}-12-31`};
 if(period==='month')return {from:anchor.slice(0,7)+'-01',to:format(new Date(Date.UTC(year,month+1,0)))};
 if(period==='week'){date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const from=format(date);date.setUTCDate(date.getUTCDate()+6);return {from,to:format(date)};}
 return {from:anchor,to:anchor};
}
