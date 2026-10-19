'use client';
import {useEffect,useState} from 'react';
import {VisualSelect} from './VisualSelect';
import {useI18n} from './LanguageProvider';
export function ClaimRecipientSelect({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const {locale}=useI18n(),en=locale==='en';const [people,setPeople]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/api/expense-claims/people',{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setPeople(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[]);
 return <div className="claim-recipient"><label>{en?'Who is this purchase for?':'这笔消费给谁'}<VisualSelect label={en?'Purchase recipient':'消费对象'} value={value} disabled={disabled} onChange={onChange} options={[{value:'',label:en?'Myself':'自己'},...people.map(p=>({value:p.id,label:p.name,icon:p.avatar}))]}/></label>{value&&<p className="muted">{en?'The member receives an invitation and chooses their own book. Payment stays in your wallet. Only this bill’s details are shared; private photos and other records stay private.':'对方将收到待认领消息，确认后自己选择账本。付款仍记在你的钱包；只分享这笔账的信息，不分享私人附图或其他账目。'}</p>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}
