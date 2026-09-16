'use client';
import {useEffect,useState} from 'react';
import type {ChatAction} from '@/lib/chat-actions';
import {VisualSelect} from './VisualSelect';
import {LineItemsEditor} from './LineItems';
import {lineItemsSchema} from '@/lib/line-items';
import {SceneFields} from './SceneFields';
import {useI18n} from './LanguageProvider';
import {amountToCents} from '@/server/model';
export function ChatActionEditor({action,onSave,onCancel}:{action:ChatAction;onSave:(data:Record<string,any>)=>Promise<void>;onCancel:()=>void}){
 const {t}=useI18n(),[data,setData]=useState({...action.data}),[options,setOptions]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const update=(key:string,value:any)=>setData(d=>({...d,[key]:value}));
 useEffect(()=>{const c=new AbortController();fetch(`/api/books/${action.bookId}/chat?options=${action.bookId}`,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(setOptions).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[action.bookId]);
 const fields:Record<string,string>={title:'账目标题',name:'名称',date:'交易日期',occurredAt:'交易时间',note:'备注',payee:'商家',nextDate:'首次扣款日期',intervalCount:'间隔数量',month:'预算月份',startDate:'分摊开始日期',periodCount:'覆盖数量',firstDate:'首次还款日期',terms:'分期期数',principal:'本次还款本金',fee:'本次手续费',fees:'总手续费',amount:'金额'};
 const keys=({entry:['title','amount','date','occurredAt','payee','note'],template:['name','title','amount','note'],schedule:['name','amount','nextDate','intervalCount','note'],budget:['amount','month'],allocation:['startDate','periodCount'],installment:['name','amount','date','terms','firstDate','fees'],repayment:['date','principal','fee']} as const)[action.kind];
 return <form className="chat-inline-editor" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const patch={...data};const form=new FormData(e.currentTarget);for(const key of keys){const v=String(form.get(key)??'');patch[key]=['amount','principal','fee','fees'].includes(key)?v?amountToCents(v):undefined:['intervalCount','periodCount','terms'].includes(key)?v?Number(v):undefined:v;}for(const key of Object.keys(patch))if(key.endsWith('Input'))delete patch[key];await onSave(patch);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
 {options&&<div className="form-grid">{!['budget','allocation'].includes(action.kind)&&<label>{t('资金钱包')}<VisualSelect label={t('资金钱包')} value={data.accountId||''} onChange={v=>update('accountId',v)} options={[{value:'',label:t('请选择')},...options.accounts.map((a:any)=>({value:a.id,label:[a.name,a.suffix].filter(Boolean).join(' · '),account:true,accountName:[a.institution,a.name].join(' ')}))]}/></label>}{!['allocation','repayment'].includes(action.kind)&&<label>{t('分类')}<VisualSelect label={t('分类')} value={data.category||''} onChange={v=>update('category',v)} options={[{value:'',label:t('请选择')},...options.categories.map((c:any)=>({value:c.name,label:c.name,icon:c.icon}))]}/></label>}</div>}
 {['entry','template','schedule'].includes(action.kind)&&<SceneFields value={data.scene} onChange={(scene,title)=>setData(d=>({...d,scene,...(title?{title}:{})}))}/>}
 <div className="form-grid">{keys.map(key=><label key={key}>{t(fields[key])}<input name={key} value={['amount','principal','fee','fees'].includes(key)?data[key+'Input']??(data[key]==null?'':String(data[key]/100)):data[key]??''} onChange={e=>update(['amount','principal','fee','fees'].includes(key)?key+'Input':key,e.target.value)} inputMode={['amount','principal','fee','fees'].includes(key)?'decimal':undefined}/></label>)}</div>
 {['entry','template','schedule'].includes(action.kind)&&<LineItemsEditor items={lineItemsSchema.safeParse(data.lineItems).success?lineItemsSchema.parse(data.lineItems):data.lineItems||[]} total={data.amountInput!==undefined?Number(data.amountInput)*100:data.amount||0} onChange={items=>update('lineItems',items)} onTotal={amount=>setData(d=>({...d,amount,amountInput:String(amount/100)}))}/>}
 {error&&<p className="error" role="alert">{error}</p>}<div className="inline"><button disabled={busy||!options}>{t('更新卡片')}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}>{t('取消修改')}</button></div>
 </form>;
}
