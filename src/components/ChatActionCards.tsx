'use client';
import {PreferenceSuggestions} from './PreferenceSuggestions';
import {changeMemorySelection,resolveMemoryField} from '@/lib/memory-fields';
import {MemorySuggestions} from './MemorySuggestions';
import {ChatActionEditor} from './ChatActionEditor';
import {LineItemsView} from './LineItems';
import {formatMoney} from '@/lib/deployment';
import {useState} from 'react';
import {Check,CalendarClock,NotebookPen,Repeat,ChartPie,Wallet,Bookmark,ArrowRightLeft,FilePenLine} from 'lucide-react';
import {actionNames,type ChatAction} from '@/lib/chat-actions';
import {useI18n} from './LanguageProvider';
import {SymbolIcon,AccountIcon} from './VisualSelect';
const icons={management:FilePenLine,memory:Bookmark,family:ArrowRightLeft,entry:NotebookPen,transaction:FilePenLine,schedule:CalendarClock,template:Bookmark,budget:ChartPie,allocation:Repeat,installment:Wallet,repayment:ArrowRightLeft};
export function ChatActionCards({onEdit,actions,disabled,confirmable,onConfirm,onCancel,onRevise}:{onEdit:(id:string,data:Record<string,any>)=>Promise<void>;actions:ChatAction[];disabled:boolean;confirmable:boolean;onConfirm:(id:string,ack:boolean)=>Promise<void>;onCancel:(id:string)=>Promise<void>;onRevise:(a:ChatAction)=>void}){
 const {t:tr}=useI18n();const [editing,setEditing]=useState('');const [saving,setSaving]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[ack,setAck]=useState<Record<string,boolean>>({});
 async function execute(a:ChatAction,cancel=false){if(saving)return;setSaving(a.id);setErrors(v=>({...v,[a.id]:''}));try{await (cancel?onCancel(a.id):onConfirm(a.id,!!ack[a.id]));}catch(e){setErrors(v=>({...v,[a.id]:(e as Error).message}));}finally{setSaving('');}}
 return <div className="chat-action-list">{actions.map(a=>{const Icon=icons[a.kind];const pending=a.status==='pending',deleting=a.kind==='transaction'&&a.data.operation==='delete';const main=a.kind==='management'?tr(a.title):a.data.title||a.data.name||tr(actionNames[a.kind]);return <section className={'chat-action-card '+(!pending?'is-resolved':'')} key={a.id} aria-label={tr(actionNames[a.kind])}>
  <div className="receipt-card-heading"><span className="chat-action-icon"><Icon size={21}/></span><div><small>{tr(actionNames[a.kind])}</small><h3>{main}</h3></div><span className={'receipt-state state-'+a.status}>{tr(a.status==='confirmed'?(deleting?'已删除':a.kind==='management'?'已执行':a.kind==='transaction'?'已修改':'已保存'):a.status==='cancelled'?'已取消':a.missing.length?'待补充':'待确认')}</span></div>
  {editing!==a.id&&typeof a.data.amount==='number'&&<div className="receipt-card-amount"><span>{tr('金额')}</span><strong>{formatMoney(a.data.amount)}</strong></div>}
  {editing!==a.id&&<details className="receipt-card-content" open={a.status!=='cancelled'}><summary>{tr('查看卡片详情')}</summary>
  <dl className="receipt-facts">{a.summary.filter(s=>!(typeof a.data.amount==='number'&&s.label==='金额')).map((s,i)=><div className={['备注','核验说明','商品摘要'].includes(s.label)?'receipt-fact-wide':''} key={i}><dt>{tr(s.label)}</dt><dd>{s.icon&&<SymbolIcon icon={s.icon} size={22}/ >}{s.account&&<AccountIcon name={s.account} size={22}/>}<span>{s.value}</span></dd></div>)}</dl>
  {pending&&a.kind==='entry'&&<PreferenceSuggestions value={a.data as any} disabled={disabled||!!saving} onChange={next=>onEdit(a.id,next)}/>}
  {pending&&<MemorySuggestions suggestions={a.data.memorySuggestions} name={a.data.product||a.data.title||''} disabled={disabled||!!saving} onChange={(next,resolution)=>{const filled=resolution?resolveMemoryField(a.data,next,resolution.id,resolution.itemId,resolution.field,resolution.useMemory):changeMemorySelection(a.data,a.data.memorySuggestions||[],next);return onEdit(a.id,{...filled.value,memorySuggestions:filled.suggestions});}}/>}
  {a.data.lineItems?.length>0&&<LineItemsView items={a.data.lineItems} total={a.data.amount||0}/>}
  {pending&&a.missing.length>0&&<section className="receipt-notice receipt-notice-missing"><strong>{tr('请补充信息')}</strong><p>{a.missing.map(m=>tr(m)).join('、')}</p></section>}
  {pending&&a.warnings.filter(w=>!a.data.processingHints?.includes(w)).length>0&&<section className="receipt-notice receipt-notice-warning"><strong>{tr('保存前请核对')}</strong><ul>{a.warnings.filter(w=>!a.data.processingHints?.includes(w)).map((w,i)=><li key={i}>{tr(w)}</li>)}</ul></section>}
  {pending&&Array.isArray(a.data.processingHints)&&a.data.processingHints.length>0&&<section className="receipt-notice receipt-notice-info"><strong>{tr('识别与处理说明')}</strong><ul>{a.data.processingHints.map((w:string,i:number)=><li key={i}>{tr(w)}</li>)}</ul></section>}
  </details>}
  {pending&&editing!==a.id&&a.kind==='entry'&&(a.warnings.some(w=>/重复|退款|duplicate|refund/i.test(w))||/重复|退款|duplicate|refund/i.test(errors[a.id]||''))&&<label className="check"><input type="checkbox" checked={!!ack[a.id]} onChange={e=>setAck(v=>({...v,[a.id]:e.target.checked}))}/>{tr('已核对重复与退款提示，仍保存为独立账单')}</label>}
  {errors[a.id]&&<p className="error" role="alert">{tr(errors[a.id])}</p>}
  {pending&&editing===a.id&&<ChatActionEditor action={a} onSave={async data=>{await onEdit(a.id,data);setAck(v=>({...v,[a.id]:false}));setEditing('');}} onCancel={()=>setEditing('')}/>}
  {pending?editing!==a.id&&<div className="receipt-card-actions"><div className="receipt-primary-actions"><button className={deleting?'receipt-danger':''} disabled={disabled||!confirmable||!!saving||!!editing||!!a.missing.length} onClick={()=>execute(a)}><Check size={17}/>{tr(saving===a.id?'处理中…':deleting?'确认删除':a.kind==='management'?'确认执行':a.kind==='transaction'?'确认修改':'确认保存')}</button>{!deleting&&a.kind!=='management'&&<button className="secondary" disabled={disabled||!!saving||!!editing} onClick={()=>setEditing(a.id)}>{tr(a.missing.length?'补充信息':'继续修改')}</button>}</div><div className="receipt-secondary-actions"><button className="text-button" disabled={disabled||!!saving||!!editing} onClick={()=>onRevise(a)}>{tr('通过对话修改')}</button><button className="text-button" disabled={disabled||!!saving||!!editing} onClick={()=>execute(a,true)}>{tr('取消这张卡片')}</button></div></div>:a.confirmedAt&&<small className="muted">{new Date(a.confirmedAt).toLocaleString()}</small>}
 </section>;})}</div>;
}
