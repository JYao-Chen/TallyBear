'use client';
import {useEffect,useState} from 'react';
import {DateField} from './DateField';
import {FormSelect} from './FormSelect';
import {periodRange,type ReportPeriod,type ReportRange} from '@/lib/report-period';

export function ReportPeriodPicker({value,onChange}:{value:ReportRange;onChange:(range:ReportRange)=>void}){
 const [period,setPeriod]=useState<ReportPeriod>(()=>{const month=periodRange('month',value.from);return month.from===value.from&&month.to===value.to?'month':'custom';});
 const [from,setFrom]=useState(value.from),[to,setTo]=useState(value.to);
 useEffect(()=>{setFrom(value.from);setTo(value.to);},[value.from,value.to]);
 const invalid=!from||!to||from>to;
 return <section className="report-period-picker" aria-label="统计周期">
  <label>统计周期<FormSelect value={period} onChange={v=>{const p=v as ReportPeriod;setPeriod(p);if(p!=='custom')onChange(periodRange(p,value.from));}}>
   <option value="year">按年</option><option value="month">按月</option><option value="week">按周</option><option value="day">指定日</option><option value="custom">自定义日期</option>
  </FormSelect></label>
  {period==='custom'?<><label>开始日期<DateField required type="date" value={from} onChange={setFrom}/></label><label>结束日期<DateField required type="date" value={to} onChange={setTo}/></label><button type="button" disabled={invalid} onClick={()=>onChange({from,to})}>应用日期</button>{invalid&&<small role="alert">结束日期不能早于开始日期</small>}</>:period==='year'?<label>统计年份<input key={value.from} type="number" min="1000" max="9999" defaultValue={value.from.slice(0,4)} onBlur={e=>{const year=e.currentTarget.value;if(/^[1-9]\d{3}$/.test(year))onChange(periodRange('year',year+'-01-01'));else e.currentTarget.value=value.from.slice(0,4);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>:<label>{period==='week'?'选择周内任一天':period==='month'?'选择月份':'交易日期'}<DateField required type={period==='month'?'month':'date'} value={period==='month'?value.from.slice(0,7):value.from} onChange={v=>onChange(periodRange(period,period==='month'?v+'-01':v))}/></label>}
  <small className="report-period-summary">{value.from} — {value.to} · 包含起止日{period==='week'?' · 周一至周日':''}</small>
 </section>;
}
