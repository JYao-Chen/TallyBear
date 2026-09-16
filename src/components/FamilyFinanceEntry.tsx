'use client';
import {useState} from 'react';
import {ArrowLeftRight} from 'lucide-react';
import {Sheet} from './Sheet';
import {VisualSelect} from './VisualSelect';
import {FamilyFinance} from './FamilyFinance';
import {useI18n} from './LanguageProvider';
export function FamilyFinanceEntry({userId,onChanged,onManage,onAssistant}:{userId:string;onChanged:()=>Promise<void>;onManage:()=>void;onAssistant:()=>void}){
 const {locale}=useI18n(),[open,setOpen]=useState(false),[families,setFamilies]=useState<any[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
 async function show(){setOpen(true);setLoading(true);setError('');try{const r=await fetch('/api/families');const d=await r.json();if(!r.ok)throw Error(d.error);setFamilies(d.items);setSelected(old=>d.items.some((f:any)=>f.id===old)?old:d.items[0]?.id||'');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 return <><button type="button" onClick={show}><ArrowLeftRight size={18}/><span>{locale==='en'?'Family transfers':'家庭往来'}</span></button>{open&&<Sheet title={locale==='en'?'Family transfers':'家庭资金往来'} onClose={()=>setOpen(false)}>{loading?<p role="status">{locale==='en'?'Loading…':'正在读取家庭…'}</p>:error?<p className="error">{error}</p>:!families.length?<div className="empty"><p>{locale==='en'?'Join or create a family to get started.':'先创建或加入一个家庭，即可记录成员转账、红包和共同入金。'}</p><button onClick={()=>{setOpen(false);onManage();}}>{locale==='en'?'Manage families':'前往家庭管理'}</button></div>:<>{families.length>1&&<VisualSelect label={locale==='en'?'Family':'选择家庭'} value={selected} onChange={setSelected} options={families.map(f=>({value:f.id,label:f.name,icon:f.avatar}))}/>}<button type="button" className="secondary" onClick={()=>{setOpen(false);onAssistant();}}>{locale==='en'?'Use AI · describe or upload a receipt':'用 AI 记往来 · 描述或上传截图'}</button><FamilyFinance key={selected} family={selected} userId={userId} onChanged={onChanged}/></>}</Sheet>}</>;
}
