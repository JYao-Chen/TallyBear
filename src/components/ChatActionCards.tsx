'use client';
import {changeMemorySelection,resolveMemoryField} from '@/lib/memory-fields';
import {MemorySuggestions} from './MemorySuggestions';
import {ChatActionEditor} from './ChatActionEditor';
import {useState} from 'react';
import {Check,CalendarClock,NotebookPen,Repeat,ChartPie,Wallet,Bookmark,ArrowRightLeft,FilePenLine} from 'lucide-react';
import {actionNames,type ChatAction} from '@/lib/chat-actions';
import {useI18n} from './LanguageProvider';
import {SymbolIcon,AccountIcon} from './VisualSelect';
const icons={memory:Bookmark,family:ArrowRightLeft,entry:NotebookPen,transaction:FilePenLine,schedule:CalendarClock,template:Bookmark,budget:ChartPie,allocation:Repeat,installment:Wallet,repayment:ArrowRightLeft};
export function ChatActionCards({onEdit,actions,disabled,confirmable,onConfirm,onCancel,onRevise}:{onEdit:(id:string,data:Record<string,any>)=>Promise<void>;actions:ChatAction[];disabled:boolean;confirmable:boolean;onConfirm:(id:string,ack:boolean)=>Promise<void>;onCancel:(id:string)=>Promise<void>;onRevise:(a:ChatAction)=>void}){
 const {t:tr}=useI18n();const [editing,setEditing]=useState('');const [saving,setSaving]=useState(''),[errors,setErrors]=useState<Record<string,string>>({}),[ack,setAck]=useState<Record<string,boolean>>({});
 async function execute(a:ChatAction,cancel=false){if(saving)return;setSaving(a.id);setErrors(v=>({...v,[a.id]:''}));try{await (cancel?onCancel(a.id):onConfirm(a.id,!!ack[a.id]));}catch(e){setErrors(v=>({...v,[a.id]:(e as Error).message}));}finally{setSaving('');}}
 return <div className="chat-action-list">{actions.map(a=>{const Icon=icons[a.kind];const pending=a.status==='pending',deleting=a.kind==='transaction'&&a.data.operation==='delete';const main=a.data.title||a.data.name||tr(actionNames[a.kind]);return <section className={'chat-action-card '+(!pending?'is-resolved':'')} key={a.id} aria-label={tr(actionNames[a.kind])}>
  <header><span className="chat-action-icon"><Icon size={21}/></span><div><small>{tr(actionNames[a.kind])}</small><h3>{main}</h3></div><span className="chat-action-status">{tr(a.status==='confirmed'?(deleting?'已删除':a.kind==='transaction'?'已修改':'已保存'):a.status==='cancelled'?'已取消':a.missing.length?'待补充':'待确认')}</span></header>
  <dl>{a.summary.map((s,i)=><div key={i}><dt>{tr(s.label)}</dt><dd>{s.icon&&<SymbolIcon icon={s.icon} size={22}/ >}{s.account&&<AccountIcon name={s.account} size={22}/>}<span>{s.value}</span></dd></div>)}</dl>
  {pending&&<MemorySuggestions suggestions={a.data.memorySuggestions} name={a.data.product||a.data.title||''} disabled={disabled||!!saving} onChange={(next,resolution)=>{const filled=resolution?resolveMemoryField(a.data,next,resolution.id,resolution.itemId,resolution.field,resolution.useMemory):changeMemorySelection(a.data,a.data.memorySuggestions||[],next);return onEdit(a.id,{...filled.value,memorySuggestions:filled.suggestions});}}/>}
  {a.data.lineItems?.length>0&&<details className="chat-action-details" open><summary>{tr('商品明细')} · {a.data.lineItems.length}</summary><ul>{a.data.lineItems.map((i:any,n:number)=><li key={n}><span>{i.name}</span><span>{i.amount===null?tr('待补充'):(i.amount/100).toFixed(2)}</span></li>)}</ul></details>}
  {pending&&a.missing.length>0&&<p className="chat-action-missing">{tr('请补充信息')}：{a.missing.map(m=>tr(m)).join('、')}</p>}
  {pending&&a.warnings.map((w,i)=><p className="chat-action-warning" key={i}>{tr(w)}</p>)}
  {pending&&a.kind==='entry'&&(a.warnings.length>0||errors[a.id])&&<label className="check"><input type="checkbox" checked={!!ack[a.id]} onChange={e=>setAck(v=>({...v,[a.id]:e.target.checked}))}/>{tr('已核对重复与退款提示，仍保存为独立账单')}</label>}
  {errors[a.id]&&<p className="error" role="alert">{tr(errors[a.id])}</p>}
  {pending&&editing===a.id&&<ChatActionEditor action={a} onSave={async data=>{await onEdit(a.id,data);setAck(v=>({...v,[a.id]:false}));setEditing('');}} onCancel={()=>setEditing('')}/>}
  {pending?<footer><button disabled={disabled||!confirmable||!!saving||!!editing||!!a.missing.length} onClick={()=>execute(a)}><Check size={17}/>{tr(saving===a.id?'正在保存…':deleting?'确认删除':a.kind==='transaction'?'确认修改':'确认保存')}</button>{!deleting&&<button className="secondary" disabled={disabled||!!saving} onClick={()=>setEditing(a.id)}>{tr(a.missing.length?'补充信息':'继续修改')}</button>}<button className="text-button" disabled={disabled||!!saving} onClick={()=>onRevise(a)}>{tr('通过对话修改')}</button><button className="text-button" disabled={disabled||!!saving} onClick={()=>execute(a,true)}>{tr('取消')}</button></footer>:a.confirmedAt&&<small className="muted">{new Date(a.confirmedAt).toLocaleString()}</small>}
 </section>;})}</div>;
}
