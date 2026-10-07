'use client';
import {PagedList} from './PagedList';

import {DateField} from './DateField';
import {formatMoney} from '@/lib/deployment';
import {useI18n} from './LanguageProvider';
import {useEffect,useState} from 'react';
import {CalendarRange,Plus,Equal,Info} from 'lucide-react';
import './allocation-panel.css';
import {CategoryIcon} from './VisualSelect';
import {periodLastDay,periodLabels,type PeriodUnit} from '@/lib/period';
import {FormSelect} from './FormSelect';
const yuan=(n:number)=>formatMoney(n);
type Allocation={title?:string;start_date:string;period_unit:PeriodUnit;period_count:number;id:string;version:number;payee:string;product:string;category:string;amount:number;refunded:number;start:string;months:number;end:string;monthly:number};
export function AllocationEditor({book,id,version,amount,date,initial,onSaved}:{book:string;id:string;version:number;amount:number;date:string;initial?:Allocation;onSaved:()=>void}){const {t:tr,locale}=useI18n();
 const [start,setStart]=useState(initial?.start_date||date.slice(0,7)+'-01'),[unit,setUnit]=useState<PeriodUnit>(initial?.period_unit||'month'),[count,setCount]=useState(initial?.period_count||initial?.months||12),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(!!initial),[net,setNet]=useState(amount);
 useEffect(()=>{if(initial)return;const c=new AbortController();fetch(`/api/books/${book}/allocations?month=${date.slice(0,7)}`,{signal:c.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);const x=data.items.find((x:Allocation)=>x.id===id);if(x){setStart(x.start_date||x.start+'-01');setUnit(x.period_unit||'month');setCount(x.period_count||x.months);setNet(x.amount-x.refunded);}setReady(true);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[book,id,date,initial]);
 let end='',preview='';try{end=periodLastDay(start,unit,count);const periods=unit==='month'?count:unit==='year'?count*12:unit==='week'?count*7:count;preview=tr('每{0} {1}{2}',[tr(unit==='month'||unit==='year'?'月':'天'),yuan(Math.floor(net/periods)),net%periods?tr('，前 {0} 期各多 0.01 元',[net%periods]):'']);}catch{}

 async function save(remove=false){setBusy(true);setError('');try{const r=await fetch(`/api/books/${book}/allocations`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,version,startDate:start,periodUnit:unit,periodCount:count,remove})});const d=await r.json();if(!r.ok)throw new Error(d.error);onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <details className="allocation-editor" open={!!initial}><summary><CalendarRange size={18}/>{tr("费用周期分摊")}</summary>{!ready&&<p>{tr("正在读取设置…")}</p>}<div className="form-grid"><label>{tr("周期数量")}<input disabled={(!ready || busy)} type="number" min={1} step={1} value={(count || '')} onChange={e=>setCount(Number(e.target.value))}/></label><label>{tr("周期单位")}<FormSelect disabled={(!ready || busy)} value={unit} onChange={v=>{setUnit(v as PeriodUnit);if(v==='month'||v==='year')setStart(start.slice(0,7)+'-01');}}>{Object.entries(periodLabels).map(([v,label])=><option key={v} value={v}>{tr(label)}</option>)}</FormSelect></label><label>{tr("开始")}{unit==='month'||unit==='year'?<DateField disabled={(!ready || busy)} type="month" value={start.slice(0,7)} onChange={value=>setStart(value?value+'-01':'')}/>:<DateField disabled={(!ready || busy)} type="date" value={start} onChange={value=>setStart(value)}/>}</label></div>{end&&<p className="notice">{start} {tr("至")}{end} · {count} {tr(periodLabels[unit])}<br/>{preview}{tr("，总额")}{yuan(net)}。</p>}{!end&&ready&&<p className="muted">{tr("请填写有效的正整数周期和开始日期。")}</p>}<></>{error&&<p className="error">{tr(error)}</p>}<button type="button" className="secondary" onClick={()=>window.dispatchEvent(new CustomEvent('open-cost-project',{detail:{id,amount:net,date}}))}>{locale==='en'?'Allocate costs & link income':'按人分担与关联收入抵减'}</button><div className="sheet-actions"><button type="button" disabled={((busy || !ready) || !end)} onClick={()=>save()}>{tr("保存分摊")}</button><button type="button" className="secondary" disabled={(busy || !ready)} onClick={()=>save(true)}>{tr("取消分摊")}</button></div></details>;
}
export function AllocationPanel({book,month,revision,canWrite,onSaved}:{book:string;month:string;revision:number;canWrite:boolean;onSaved:()=>void}){const {t:tr,locale}=useI18n();
 const [attempt,setAttempt]=useState(0);
 const [data,setData]=useState<{items:Allocation[];allocated:number;ordinary:number;total:number}|null>(null),[error,setError]=useState(''),[editing,setEditing]=useState('');
 useEffect(()=>{const c=new AbortController();setData(null);setError('');fetch(`/api/books/${book}/allocations?month=${month}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[book,month,revision,attempt]);
 const copy=(zh:string,en:string)=>locale==='en'?en:zh;
 const active=data?.items.filter(a=>a.start_date<=month+'-31'&&a.end>=month+'-01').length||0;
 return <section className="panel allocation-panel" aria-busy={!data&&!error}>
 <header className="allocation-heading"><div><h2><CalendarRange size={22}/>{copy('按月看费用','Monthly expenses')}</h2><p>{copy('把一次付款的长期费用，分到实际使用的月份。','Spread a one-off payment over the months it covers.')}</p></div><span className="allocation-month">{month}</span></header>
 {error&&<div role="alert" className="error"><p>{tr(error)}</p><button type="button" className="secondary" onClick={()=>setAttempt(v=>v+1)}>{copy('重新加载','Try again')}</button></div>}
 {!data&&!error&&<p role="status">{copy('正在读取本月费用和分摊明细…','Loading monthly expenses and allocations…')}</p>}
 {data&&<>
 <div className="allocation-equation" aria-label={copy('本月费用构成','Monthly expense breakdown')}>
 <div className="allocation-term"><span>{copy('日常费用（扣除退款）','Everyday expenses, less refunds')}</span><strong>{yuan(data.ordinary)}</strong><small>{copy('未设置分摊的支出与退款','Expenses and refunds without an allocation')}</small></div>
 <Plus className="allocation-operator" size={20} aria-hidden="true"/>
 <div className="allocation-term"><span>{copy('本月分摊费用','Allocated to this month')}</span><strong>{yuan(data.allocated)}</strong><small>{copy('来自下方已设置的分摊','From the allocations listed below')}</small></div>
 <Equal className="allocation-operator" size={20} aria-hidden="true"/>
 <div className="allocation-result"><span>{copy('本月费用合计','Total monthly expenses')}</span><strong>{yuan(data.total)}</strong><small>{copy('按使用月份计算的费用','Expenses attributed to the month of use')}</small></div>
 </div>
 <p className="allocation-explanation"><Info size={18} aria-hidden="true"/><span>{copy('原付款已从日常费用中排除，只计入本月分摊，避免重复。分摊不会再次扣款，也不改变钱包余额。','The original payment is excluded from everyday expenses; only this month’s share is included. Allocations do not charge your wallet again or change its balance.')}</span></p>
 <section className="allocation-list" aria-labelledby="allocation-list-title"><div className="allocation-list-heading"><h3 id="allocation-list-title">{copy('分摊明细','Allocation details')}</h3><span>{copy(`共 ${data.items.length} 项 · 本月覆盖 ${active} 项`,`${data.items.length} allocations · ${active} cover this month`)}</span></div>
 {!data.items.length?<div className="allocation-empty"><h4>{copy('还没有设置费用分摊','No allocations yet')}</h4><p>{copy('服务器、会员或房租等一次支付、长期使用的费用，可以按覆盖周期分摊。打开一笔支出，在“费用周期分摊”中设置即可。','For a server, membership or rent paid upfront, open the expense and set its coverage under “Expense period allocation”.')}</p></div>:<PagedList items={data.items} resetKey={book+month}>{a=>{
 const status=a.start_date>month+'-31'?copy('尚未开始','Not started'):a.end<month+'-01'?copy('已结束','Ended'):copy('本月覆盖','Covers this month');
 return <article className="allocation-item" key={a.id}>
 <div className="allocation-item-heading"><div className="allocation-item-title"><CategoryIcon name={a.category}/><h4>{a.title||a.payee||a.product||a.category}</h4><span className="allocation-status">{status}</span></div><div className="allocation-item-share"><span>{copy('本月计入','This month')}</span><strong>{yuan(a.monthly)}</strong></div></div>
 <dl className="allocation-facts"><div><dt>{copy('原付款金额','Original payment')}</dt><dd>{yuan(a.amount)}{a.refunded>0&&<small>{copy('已退款 ','Refunded ')}{yuan(a.refunded)}</small>}</dd></div><div><dt>{copy('费用覆盖时间','Coverage')}</dt><dd><time>{a.start_date}</time><span> — </span><time>{a.end}</time></dd></div><div><dt>{copy('分摊周期','Allocation period')}</dt><dd>{a.period_count} {tr(periodLabels[a.period_unit])}</dd></div>{canWrite&&<div className="allocation-item-action"><button type="button" className="secondary" aria-expanded={editing===a.id} aria-controls={'allocation-edit-'+a.id} onClick={()=>setEditing(editing===a.id?'':a.id)}>{editing===a.id?copy('收起设置','Close settings'):tr('调整分摊')}</button></div>}</dl>
 {editing===a.id&&<div id={'allocation-edit-'+a.id}><AllocationEditor key={a.id+':'+a.version} book={book} id={a.id} version={a.version} amount={a.amount-a.refunded} date={a.start+'-01'} initial={a} onSaved={()=>{setEditing('');onSaved();}}/></div>}
 </article>;
 }}</PagedList>}
 </section>
 </>}
 </section>;
}
