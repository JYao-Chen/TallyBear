'use client';
import {PagedList} from './PagedList';
import {formatMoney} from '@/lib/deployment';
import {useI18n} from './LanguageProvider';
import {VisualSelect,CategoryIcon} from './VisualSelect';
import {useEffect,useState} from 'react';
import {Plus,ChevronRight} from 'lucide-react';
import {Sheet} from './Sheet';
import {TransactionList} from './TransactionList';
import {useEntryDetail} from './EntryDetailContext';
import {monthRange,type LedgerReport} from '@/lib/ledger-types';
import {LIST_PAGE_SIZE} from '@/lib/pagination';
import {amountToCents} from '@/server/model';
type Budget={category:string;amount:number;previousCategory?:string};
const yuan=formatMoney;
function BudgetDetails({book,month,budget,canWrite,onEdit,onClose}:{book:string;month:string;budget:Budget;canWrite:boolean;onEdit:()=>void;onClose:()=>void}){
 const {t}=useI18n(),openEntry=useEntryDetail();
 const [offset,setOffset]=useState(0),[report,setReport]=useState<LedgerReport|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setReport(null);setError('');
  const query=new URLSearchParams({...monthRange(month),category:budget.category,mode:'exact',kind:'net_expense',offset:String(offset),limit:String(LIST_PAGE_SIZE)});
  fetch('/api/books/'+book+'/report?'+query,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);return data;}).then(data=>{if(!controller.signal.aborted)setReport(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();
 },[book,month,budget.category,offset,retry]);
 const spent=report?report.totals.expense-report.totals.refund:0;
 return <Sheet title={budget.category+' · '+t('预算明细')} onClose={onClose}>
  <div className="panel-title"><p>{month} · {t('预算金额（元）')} {yuan(budget.amount)}</p>{canWrite&&<button type="button" className="secondary" onClick={onEdit}>{t('修改预算')}</button>}</div>
  <p className="muted">{t('按当前账本、所选月份和预算分类统计，退款冲减消费。')}</p>
  {error?<div role="alert"><p className="error">{t(error)}</p><button type="button" className="secondary" onClick={()=>setRetry(n=>n+1)}>{t('重新加载')}</button></div>:!report?<p role="status">{t('正在读取账单…')}</p>:<>
   <p>{t('已消费')} <strong>{yuan(spent)}</strong> · {spent>budget.amount?t('已超支 ')+yuan(spent-budget.amount):t('还可用 ')+yuan(budget.amount-spent)}</p>
   {report.rows.length?<TransactionList rows={report.rows} onSelect={row=>{onClose();openEntry?.(row);}}/>:<p className="empty">{t('本月此分类暂无消费。')}</p>}
   {report.totals.count>LIST_PAGE_SIZE&&<div className="pagination"><button type="button" className="secondary" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-LIST_PAGE_SIZE))}>{t('上一页')}</button><span>{offset+1}–{Math.min(offset+LIST_PAGE_SIZE,report.totals.count)} / {report.totals.count}</span><button type="button" className="secondary" disabled={offset+LIST_PAGE_SIZE>=report.totals.count} onClick={()=>setOffset(n=>n+LIST_PAGE_SIZE)}>{t('下一页')}</button></div>}
  </>}
 </Sheet>;
}
export function BudgetPanel({book,month,budgets,spending,categories,canWrite,onSave,onDelete}:{book:string;month:string;budgets:Budget[];spending:{name:string;value:number}[];categories:string[];canWrite:boolean;onSave:(b:Budget)=>Promise<void>;onDelete:(category:string)=>Promise<void>}){
 const {t:tr,locale}=useI18n();
 const [editing,setEditing]=useState<Budget|null>(null),[open,setOpen]=useState(false),[selected,setSelected]=useState<Budget|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();setOpen(false);setSelected(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel"><div className="panel-title"><h2>{locale==='en'?new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'))+' · '+tr('每月预算'):month.replace('-','年')+tr('月预算')}</h2>{canWrite&&<button type="button" className="text-button" onClick={()=>{setEditing(null);setOpen(true);setError('');}}><Plus size={18}/>{tr('添加')}</button>}</div>
  <PagedList items={budgets} resetKey={month}>{b=>{const spent=spending.find(s=>s.name===b.category)?.value||0;return <button type="button" className="budget-card" key={b.category} onClick={()=>setSelected(b)}><div className="rank"><strong><CategoryIcon name={b.category}/>{b.category}</strong><span>{yuan(spent)} / {yuan(b.amount)} <ChevronRight size={15}/></span></div><progress max={b.amount||1} value={Math.max(0,Math.min(spent,b.amount||1))}/><small className={spent>b.amount?'expense':''}>{spent>b.amount?tr('已超支 ')+yuan(spent-b.amount):tr('还可用 ')+yuan(b.amount-spent)}</small></button>;}}</PagedList>
  {!budgets.length&&<div className="empty">{tr('还没有预算，添加一个分类额度开始规划。')}</div>}
  {selected&&!open&&<BudgetDetails key={book+month+selected.category} book={book} month={month} budget={selected} canWrite={canWrite} onClose={()=>setSelected(null)} onEdit={()=>{setEditing(selected);setOpen(true);setError('');}}/>}
  {open&&<Sheet title={editing?tr('调整分类预算'):tr('添加分类预算')} onClose={()=>{if(!busy)setOpen(false);}}>{error&&<p className="error" role="alert">{tr(error)}</p>}<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const amount=amountToCents(String(f.get('amount')));void run(()=>onSave({category:String(f.get('category')),amount,...(editing?{previousCategory:editing.category}:{})}));}catch(e){setError((e as Error).message);}}}>
   <label>{tr('分类')}<VisualSelect name="category" defaultValue={editing?.category} options={Array.from(new Set([...(editing?[editing.category]:[]),...categories,...spending.map(s=>s.name)])).map(c=>({value:c,label:c}))}/></label>
   <label>{tr('预算金额（元）')}<input name="amount" inputMode="decimal" defaultValue={editing?editing.amount/100:''} required/></label>
   <div className="sheet-actions">{editing&&<button type="button" className="secondary" disabled={busy} onClick={()=>run(()=>onDelete(editing.category))}>{tr('删除预算')}</button>}<button disabled={busy}>{tr('保存预算')}</button></div>
  </form></Sheet>}
 </section>;
}
