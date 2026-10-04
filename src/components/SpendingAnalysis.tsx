'use client';
import {useEffect,useState} from 'react';
import {BookOpen,UserRound,Wallet,ScanLine,ChevronDown,Check} from 'lucide-react';
import {useI18n} from './LanguageProvider';
import {RecordsPanel,type AnalysisResult} from './RecordsPanel';
import {WalletFundsPanel} from './WalletFundsPanel';
import {ReportPeriodPicker} from './ReportPeriodPicker';
import {FinanceChart} from './InteractiveFinanceChart';
import {Sheet} from './Sheet';
import {FormSelect} from './FormSelect';
import type {ManagedBook} from './ManagementPages';
import type {AccountIdentity} from '@/lib/accounts';
import {monthRange,type LedgerRow} from '@/lib/ledger-types';
import {financeQuerySchema} from '@/lib/finance-query';
import {deployment} from '@/lib/deployment';
import './spending-analysis.css';

// Operate: one accounting question, one query, one set of totals and details.
// Preserve TallyBear's cream surfaces, warm ink, green/red amounts and Lucide controls.
// First viewport: three named scopes, selection and period; totals precede charts and entries.
// Switching scope clears old figures; chart drilldowns carry the exact active filters.
// Finish: desktop/mobile, Chinese/English, behavioral review and surface documentation.
type Mode='book'|'personal_expense'|'funds';
type Props={book:string;books:ManagedBook[];month:string;revision:number;accounts:(AccountIdentity&{id:string})[];categories:{name:string}[];shared:boolean;canWrite:boolean;onSelect:(row:LedgerRow)=>void;onChanged:()=>void;onReconcile:()=>void;onPlans:()=>void};
export function SpendingAnalysis(props:Props){
 const {locale}=useI18n(),en=locale==='en',text=(zh:string,eng:string)=>en?eng:zh;
 const [mode,setMode]=useState<Mode>('book'),[range,setRange]=useState(()=>monthRange(props.month));
 const [selectedBooks,setSelectedBooks]=useState<string[]>([props.book]),[choosing,setChoosing]=useState(false);
 const [result,setResult]=useState<AnalysisResult|null>(null),[loading,setLoading]=useState(true);
 const [owner,setOwner]=useState('personal'),[families,setFamilies]=useState<{id:string;name:string}[]>([]);
 useEffect(()=>{const controller=new AbortController();fetch('/api/families',{signal:controller.signal}).then(r=>r.json()).then(data=>{if(!controller.signal.aborted)setFamilies(data.items||[]);}).catch(()=>{});return()=>controller.abort();},[]);
 const availableIds=selectedBooks.filter(id=>props.books.some(b=>b.id===id));
 const ids=availableIds.length?availableIds:[props.books.find(b=>b.id===props.book)?.id||props.books[0]?.id].filter((id):id is string=>!!id);
 const description=mode==='book'?text('按记录归属统计日常消费与当期分摊。多个账本里的同一笔记录只计算一次。','Everyday spending and allocated costs in the selected books. Linked copies count once.'):
  mode==='personal_expense'?text('跨账本查看本人承担的费用：日常消费按本人钱包归属，分摊按本人份额。付款人不等于费用承担人。','Your expenses across books: everyday spending from your wallets, plus your share of allocated costs. The payer and cost bearer may differ.'):
  text('查看真实付款、收款、家庭往来和余额变化。一次付款只记录一次，分摊不会再次扣款。','Actual payments, receipts, household transfers and balance changes. Allocations never charge a wallet again.');
 const changeMode=(next:Mode)=>{setMode(next);setResult(null);setLoading(true);setSelectedBooks(next==='book'?[props.book]:props.books.map(b=>b.id));};
 const r=result?.report,expense=(r?.totals.expense||0)-(r?.totals.refund||0),income=r?.totals.income||0;
 const money=(n:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:deployment().currency}).format(n/100);
 const filters=result?financeQuerySchema.parse({from:range.from,to:range.to,bookIds:ids,scope:mode==='personal_expense'?mode:'books',basis:'period_expense',query:new URLSearchParams(result.query).get('q')||'',category:new URLSearchParams(result.query).get('category')||'',kind:new URLSearchParams(result.query).get('kind')||'all'}):undefined;
 const chartBase={books:ids,filters,...(mode==='personal_expense'?{scope:'personal_expense' as const}:{}),...range,unit:deployment().currency};
 return <div className="spending-analysis">
  <div className="analysis-modes" role="group" aria-label={text('统计口径','Accounting view')}>
   {([{key:'book',Icon:BookOpen,title:text('账本收支','Book expenses'),sub:text('记录归属','By book')},{key:'personal_expense',Icon:UserRound,title:text('我的费用','My expenses'),sub:text('本人承担 · 跨账本','My share · Across books')},{key:'funds',Icon:Wallet,title:text('钱包资金流','Wallet cash flow'),sub:text('实际进出','Actual money movements')}] as const).map(({key,Icon,title,sub})=><button type="button" key={key} aria-pressed={mode===key} onClick={()=>changeMode(key)}><Icon size={21}/><span><strong>{title}</strong><small>{sub}</small></span>{mode===key&&<Check size={16} className="analysis-mode-check"/>}</button>)}
  </div>
  <p className="analysis-description">{description}</p>
  <div className="analysis-controls">
   {mode==='funds'?<label>{text('钱包归属','Wallet owner')}<FormSelect value={owner} onChange={setOwner}><option value="personal">{text('我的个人钱包','My personal wallets')}</option>{families.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</FormSelect></label>:<div className="analysis-book-choice"><span>{text('统计账本','Selected books')}</span><button type="button" className="secondary" onClick={()=>setChoosing(true)}><BookOpen size={17}/><span>{ids.length===props.books.length?text('全部可访问账本','All accessible books'):ids.length===1?props.books.find(b=>b.id===ids[0])?.name:text(`已选 ${ids.length} 个账本`,`${ids.length} books selected`)}</span><ChevronDown size={17}/></button></div>}
   <button type="button" className="text-button" onClick={props.onReconcile}><ScanLine size={17}/>{text('智能核对账单','Reconcile statements')}</button>
  </div>
  <ReportPeriodPicker value={range} onChange={value=>{setRange(value);setResult(null);setLoading(true);}}/>
  {mode==='funds'?<WalletFundsPanel key={owner} owner={owner} from={range.from} to={range.to} revision={props.revision}/>:<>
   {!!r?.excludedCosts?.length&&<aside className="notice" role="status"><strong>{text('部分分摊需要重新核对','Some allocations need review')}</strong><p>{text('原付款已变化，当前暂按原付款显示，不能视为完整的分摊结果。','Original payments changed. The affected payments are shown in full until reviewed; these are not complete allocation totals.')}</p><button type="button" className="text-button" onClick={props.onPlans}>{text('前往计划与分摊','Review allocation plans')}</button></aside>}
   <div className="analysis-summary" aria-busy={loading} aria-label={text('筛选结果汇总','Filtered totals')}>
    {[[text('收入','Income'),income,'income'],[text('当期净支出','Period net expenses'),expense,'expense'],[text('收支结余','Income less expenses'),income-expense,'']].map(([label,value,cls])=><div key={String(label)}><span>{label}</span><strong className={String(cls)}>{loading||!r?'—':money(Number(value))}</strong></div>)}
   </div>
   <p className="analysis-summary-note">{text('净支出 = 消费与当期分摊 − 退款；转账不计消费。筛选同时作用于汇总、图表、明细和导出。','Net expenses = purchases and allocated costs − refunds. Transfers are not consumption. Filters apply to totals, charts, entries and export.')}</p>
   {!loading&&r&&<div className="chart-grid analysis-charts"><FinanceChart chart={{...chartBase,id:'analysis-daily',title:text('每日净支出','Daily net expenses'),dimension:'daily_expense',type:'bar',data:r.daily.map(d=>({name:d.date,value:d.expense/100}))}}/><FinanceChart chart={{...chartBase,id:'analysis-categories',title:text('费用分类','Expense categories'),dimension:'category',type:r.categories.some(c=>c.value<0)?'bar':'pie',data:r.categories.map(c=>({name:c.name,value:c.value/100}))}}/>{income!==0&&<FinanceChart chart={{...chartBase,id:'analysis-income',title:text('每日收入','Daily income'),dimension:'daily_income',metric:'income',type:'line',data:r.daily.map(d=>({name:d.date,value:d.income/100}))}}/>}</div>}
   <RecordsPanel {...props} book={ids[0]||props.book} shared={ids.some(id=>props.books.find(b=>b.id===id)?.kind==='shared')} canWrite={ids.length===1&&props.books.find(b=>b.id===ids[0])?.role!=='viewer'} key={mode+ids.join(',')} bookIds={ids} dateRange={range} scope={mode} periodOnly showScope={false} onScopeChange={()=>{}} onLoadingChange={value=>{setLoading(value);if(value)setResult(null);}} onReportChange={setResult}/>
  </>}
  {choosing&&<Sheet title={text('选择统计账本','Choose books')} onClose={()=>setChoosing(false)}><div className="analysis-book-options"><label className="check"><input type="checkbox" checked={ids.length===props.books.length} onChange={e=>setSelectedBooks(e.target.checked?props.books.map(b=>b.id):[props.book])}/>{text('全部可访问账本','All accessible books')}</label>{props.books.map(b=><label key={b.id} className="check"><input type="checkbox" checked={ids.includes(b.id)} disabled={ids.length===1&&ids[0]===b.id} onChange={e=>{setResult(null);setLoading(true);setSelectedBooks(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id));}}/><span><strong>{b.name}</strong><small>{text(b.kind==='private'?'私人账本':'共享账本',b.kind==='private'?'Private book':'Shared book')}</small></span></label>)}<p className="muted">{text('仅可选择有查看权限的账本；同一笔账的关联副本不会重复计算。','Only books you can access. Linked copies of the same entry are never counted twice.')}</p><button type="button" onClick={()=>setChoosing(false)}>{text('完成选择','Done')}</button></div></Sheet>}
 </div>;
}
