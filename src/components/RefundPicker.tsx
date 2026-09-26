'use client';
import {useEffect,useState} from 'react';
import {formatMoney} from '@/lib/deployment';
import {amountToCents} from '@/server/model';
import {refundFromNet} from '@/lib/refund-calculation';
import {useI18n} from './LanguageProvider';
import {GlobalSearch,type SearchResult} from './GlobalSearch';
import type {Original} from './DraftReview';

type Choice=Original&{title?:string;remaining?:number};
export function RefundPicker({book,books=[],value,onChange,onSelect,exclude,local=[],amount,onAmountChange}:{book:string;books?:{id:string;name:string;icon?:string;role?:string}[];value:string;onChange:(id:string)=>void;onSelect?:(row:SearchResult)=>void;exclude?:string;local?:Original[];amount?:number;onAmountChange?:(amount:number)=>void}){
 const {t:tr}=useI18n();const [selected,setSelected]=useState<Choice|null>(null),[desiredNet,setDesiredNet]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  setDesiredNet('');setError('');setSelected(null);if(!value)return;
  const draft=local.find(r=>r.id===value);if(draft){setSelected(draft);return;}
  const abort=new AbortController();
  fetch('/api/books/'+book+'/refund-options?'+new URLSearchParams({id:value,exclude:exclude||''}),{signal:abort.signal}).then(async r=>{const rows=await r.json();if(!r.ok)throw new Error(rows.error);if(!abort.signal.aborted)setSelected(rows[0]||null);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
  return()=>abort.abort();
 },[book,value,exclude]);
 function useNet(){if(selected?.remaining===undefined||!onAmountChange)return;try{const text=desiredNet.trim();const net=text.startsWith('-')?-amountToCents(text.slice(1)):amountToCents(text);const refund=refundFromNet(selected.remaining,net);if(refund===null)throw new Error('目标净支出须低于当前净支出。');onAmountChange(refund);setError('');}catch(e){setError((e as Error).message);}}
 return <section className="refund-picker">
  <GlobalSearch book={book} books={books} exclude={exclude} selection={{label:'关联原消费 · 搜索已入账订单',kind:'expense',requireWrite:true,onSelect:row=>{setSelected(row.detail);onChange(row.id);onSelect?.(row);}}}/>
  <small className="muted">{tr('支持跨账本、多关键词、金额和日期筛选；选中后填充原单信息。')}</small>
  {!!local.length&&<details><summary>{tr('关联本批草稿')}</summary>{local.map(r=><button type="button" className="text-button" key={r.id} onClick={()=>{setSelected(r);onChange(r.id);}}>{r.date} · {r.product||r.payee} · {formatMoney(r.amount)}</button>)}</details>}
  {selected&&<div className="refund-selected" aria-live="polite"><strong>{tr('已关联：')}{selected.title||selected.product||selected.payee}</strong><span>{selected.date} · {tr('原支付')} {formatMoney(selected.amount)}</span>{selected.remaining!==undefined&&<><span>{tr('此前已退')} {formatMoney(selected.amount-selected.remaining)} · {tr('当前净支出')} {formatMoney(selected.remaining)}</span>{amount!==undefined&&<span>{tr('本次到账后净支出')} {formatMoney(selected.remaining-amount)}</span>}</>}<button type="button" className="text-button" onClick={()=>{onChange('');setSelected(null);}}>{tr('取消关联')}</button></div>}
  {selected?.remaining!==undefined&&onAmountChange&&<div className="refund-net-input"><label>{tr('也可以按退款后净支出计算')}<input inputMode="decimal" value={desiredNet} placeholder={tr('可为负数，例如 -5.00')} onChange={e=>setDesiredNet(e.target.value)}/></label><button type="button" className="secondary" onClick={useNet}>{tr('换算为本次退款金额')}</button></div>}
  <small className="muted">{tr('退款 / 返现可多次记录，累计可超过原支付；净支出可为负数。')}</small>{error&&<p className="error" role="alert">{tr(error)}</p>}
 </section>;
}
