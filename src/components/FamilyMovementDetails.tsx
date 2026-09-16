'use client';
import {useEffect,useState} from 'react';
import {Sheet} from './Sheet';
import {VisualSelect,AccountIcon} from './VisualSelect';
import {formatMoney} from '@/lib/deployment';
import type {LedgerRow} from '@/lib/ledger-types';
export function FamilyMovementDetails({row,onClose,onChanged}:{row:LedgerRow;onClose:()=>void;onChanged:()=>Promise<void>}){
 const [options,setOptions]=useState<any>(null),[book,setBook]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const c=new AbortController();fetch('/api/family-finance/'+row.movement_family_id,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).then(d=>{setOptions(d);setBook(d.movements.find((m:any)=>m.id===row.id)?.displayBookId||'');}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[row.id,row.movement_family_id]);
 async function save(){setBusy(true);setError('');try{const r=await fetch('/api/family-finance/'+row.movement_family_id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'display',id:row.id,displayBookId:book||null})});const d=await r.json();if(!r.ok)throw Error(d.error);await onChanged();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Sheet title="这笔家庭往来" onClose={()=>{if(!busy)onClose();}}><h3>{row.title}</h3><p><strong>{formatMoney(row.amount)}</strong> · {String(row.date).slice(0,10)}</p><p><AccountIcon name={row.account_institution||row.account_name} size={20}/> {row.account_name}</p>{row.note&&<p>{row.note}</p>}<p className="muted">{row.movement_status==='pending'?'等待收款人确认':row.kind==='transfer'?'内部转账，不计消费':'已计入个人收支，家庭汇总时抵消'}</p>{options&&<><label>记入我的账本<VisualSelect label="记入我的账本" value={book} onChange={setBook} options={[{value:'',label:'暂不展示在个人账本'},...options.books.map((b:any)=>({value:b.id,label:b.name,icon:b.icon}))]}/></label><button disabled={busy} onClick={save}>{busy?'保存中…':'保存账本归属'}</button></>}{error&&<p className="error" role="alert">{error}</p>}</Sheet>;
}
