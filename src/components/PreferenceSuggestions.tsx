'use client';
import {useState} from 'react';
import {preferenceValue,resolvePreference,type PreferenceInput,type PreferenceField} from '@/lib/preference-learning';
import {useI18n} from './LanguageProvider';

const labels:Record<PreferenceField,[string,string]>={category:['分类','Category'],accountId:['钱包','Wallet'],payee:['商家','Merchant'],platform:['平台','Platform'],'scene.type':['消费场景','Context'],'scene.transport':['交通方式','Transport'],'scene.origin':['出发地','Origin'],'scene.destination':['目的地','Destination'],'scene.merchant':['商家简称','Merchant name'],'scene.branch':['门店','Branch'],'scene.meal':['用餐类型','Meal'],'scene.diningMode':['用餐方式','Dining mode']};
const values:Record<string,[string,string]>={transport:['交通','Transport'],dining:['餐饮','Dining'],shopping:['购物','Shopping'],groceries:['买菜','Groceries'],delivery:['外卖','Delivery'],dine_in:['堂食','Dine in'],takeaway:['自取','Takeaway']};
export function PreferenceSuggestions<T extends PreferenceInput>({value,onChange,disabled=false}:{value:T;onChange:(value:T)=>void|Promise<void>;disabled?:boolean}){
 const {locale}=useI18n(),en=locale==='en';const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const suggestions=value.preferenceSuggestions||[];if(!suggestions.length)return null;
 const applied=suggestions.filter(s=>s.state==='applied'&&preferenceValue(value,s.field)===s.value);
 const fields=[...new Set(suggestions.map(s=>s.field))];
 return <section className="preference-suggestions" aria-label={en?'Personal preferences':'个人偏好建议'}>
  <div className="preference-heading"><strong>{en?'From your personal profile':'来自你的个人画像'}</strong><button type="button" className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{en?(expanded?'Hide evidence':'Review suggestions'):(expanded?'收起依据':'查看与调整')}</button></div>
  <p className="muted">{en?`${applied.length} ${applied.length===1?'field':'fields'} suggested. Check before saving; current details take priority.`:`已预填 ${applied.length} 项；请核对本次情况，本次输入优先。`}</p>
  {expanded&&<div className="preference-fields">{fields.map(field=><div className="preference-field" key={field}><strong>{labels[field][en?1:0]}</strong>{suggestions.filter(s=>s.field===field).map(s=>{
   const active=s.state==='applied'&&preferenceValue(value,field)===s.value;
   const label=field.startsWith('scene.')&&values[s.label]?values[s.label][en?1:0]:s.label;
   return <div className="preference-option" key={s.value}><div><span>{label}</span><small>{s.basis==='rule'?(en?'Your explicit rule':'你设置的明确规则'):en?`${s.count} related records`:`${s.count} 条相关记录`}{s.state==='dismissed'?(en?' · dismissed':' · 未采用'):active?(en?' · filled':' · 已预填'):''}</small><small>{s.sources.map(r=>`${r.date} ${r.title}`).join('；')}</small></div><button type="button" className="text-button" disabled={disabled||busy} onClick={async()=>{setBusy(true);setError('');try{await onChange(resolvePreference(value,s,!active,en));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{en?(active?'Undo fill':'Use this'):(active?'撤回填充':'采用')}</button></div>;
  })}</div>)}</div>}
  {error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
