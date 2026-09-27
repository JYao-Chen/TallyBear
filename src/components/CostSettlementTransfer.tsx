'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,RefreshCw} from 'lucide-react';
import {useI18n} from './LanguageProvider';
import {formatMoney} from '@/lib/deployment';
import {PagedList} from './PagedList';

// Operate: extend the existing cost surface. Real transfers and cost shares stay distinct;
// inline forms retain the theme, and receipt confirmation belongs to the recipient.
type Movement={movement_id:string;sender_id:string;recipient_id:string;amount:number;status:string;date:string;note:string};
type Project={id:string;version:number;familyId:string|null;active:boolean;valid:boolean;archived:boolean;movements:Movement[];members:{user_id:string;name:string}[]};
export function CostSettlementTransfer({project,userId,onChanged}:{project:Project;userId:string;onChanged:()=>Promise<void>}){
 const {locale}=useI18n(),l=(zh:string,en:string)=>locale==='en'?en:zh;
 const [wallets,setWallets]=useState<{id:string;name:string}[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [editing,setEditing]=useState(false),[id,setId]=useState(''),[recipient,setRecipient]=useState(''),[source,setSource]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})),[note,setNote]=useState(''),[similar,setSimilar]=useState(false),[receiving,setReceiving]=useState(''),[target,setTarget]=useState('');
 useEffect(()=>{let live=true;fetch('/api/assets').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;}).then(d=>{if(live)setWallets(d.filter((a:any)=>a.owner_id===userId&&!a.archived));}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[userId]);
 const person=(id:string)=>project.members.find(m=>m.user_id===id)?.name||l('成员','Member');
 async function act(body:Record<string,unknown>){
  setBusy(true);setError('');setNotice('');
  try{const r=await fetch(`/api/cost-projects/${project.id}/settlement-transfer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:project.version,...body})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');setEditing(false);setReceiving('');setNotice(body.operation==='create'?l('转款已记录，等待对方确认到账；确认后自动计入本项目结算。','Transfer recorded. It settles this project once the recipient confirms receipt.'):body.operation==='confirm'?l('已确认到账，钱包余额和项目结算已更新。','Receipt confirmed. Wallet balances and project settlement updated.'):l('已取消待确认转款，未计入结算。','Pending transfer cancelled; no settlement recorded.'));window.dispatchEvent(new Event('cost-payment-recorded'));await onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 if(!project.familyId)return null;
 return <div className="cost-transfer" aria-label={l('成员转款与收款','Member transfers and receipts')}>
  <div className="cost-toolbar"><h4>{l('成员转款与收款','Member transfers and receipts')}</h4><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);try{await onChanged();}finally{setBusy(false);}}}><RefreshCw size={16}/>{l('刷新状态','Refresh status')}</button></div>
  <p className="muted">{l('这里记录真实成员转款，不重复记房租等费用。双方余额在收款人确认后更新；个人承担仍按分摊规则统计。','Record actual member transfers here, without duplicating the expense. Both wallet balances update after receipt confirmation; cost shares still follow the allocation rules.')}</p>
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
  {!editing?<button type="button" disabled={busy||loading||!project.active||!project.valid||project.archived} onClick={()=>{setId(crypto.randomUUID());setRecipient('');setSource('');setAmount('');setNote('');setSimilar(false);setEditing(true);setReceiving('');setError('');}}>{l('向成员结算','Settle with a member')}</button>:<form onSubmit={e=>{e.preventDefault();void act({operation:'create',id,sourceId:source,recipientId:recipient,amount:Math.round(Number(amount)*100),date,note,allowSimilar:similar});}}><fieldset disabled={busy||loading}><legend>{l('记录已发生的转款','Record a completed transfer')}</legend><div className="form-grid">
   <label>{l('收款成员','Recipient')}<select required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">{l('选择成员','Choose member')}</option>{project.members.filter(m=>m.user_id!==userId).map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></label>
   <label>{l('我的付款钱包','My payment wallet')}<select required value={source} onChange={e=>setSource(e.target.value)}><option value="">{l('选择钱包','Choose wallet')}</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
   <label>{l('实际转款金额','Actual transfer amount')}<input required type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label>{l('转款日期','Transfer date')}<input required type="date" max={new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})} value={date} onChange={e=>setDate(e.target.value)}/></label>
  </div><label>{l('转款备注（选填）','Transfer note (optional)')}<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><label className="check"><input type="checkbox" checked={similar} onChange={e=>setSimilar(e.target.checked)}/>{l('同日同金额仍是另一笔真实转款','This is a separate transfer even if the date and amount match')}</label>
  {!loading&&!wallets.length&&<p className="error">{l('请先在资金资产中添加个人钱包。','Add a personal wallet in Assets first.')}</p>}
  <p className="muted">{l('不代替微信或银行转账。已在家庭往来记过的，请使用下方“关联已有结算”。','This does not send money through a bank or payment app. If already recorded, use “Link settlement” below.')}</p>
  <div className="cost-toolbar"><button type="submit" disabled={!wallets.length}>{busy?l('正在记录…','Recording…'):l('已转款，等待对方确认','Record transfer for recipient confirmation')}</button><button type="button" className="text-button" onClick={()=>setEditing(false)}>{l('取消','Cancel')}</button></div></fieldset></form>}
  <h4>{l('本项目的结算流水','Project settlement transfers')}</h4>
  {!project.movements.length&&<p className="muted">{l('还没有成员结算记录。转款后在这里记录，或关联已有转账。','No settlement transfers yet. Record a transfer here or link an existing one.')}</p>}
  <PagedList items={project.movements}>{m=><div className="cost-offset"><div className="cost-toolbar"><span>{person(m.sender_id)} <ArrowRight size={14} aria-hidden="true"/> {person(m.recipient_id)}</span><strong>{formatMoney(m.amount)}</strong></div><small>{m.date} · {m.status==='confirmed'?l('已到账 · 已计入结算','Received · settled'):m.status==='cancelled'?l('已取消','Cancelled'):l('待收款人确认 · 未计入结算','Awaiting receipt · not settled')}</small>{m.note&&<p>{m.note}</p>}
   {m.status==='pending'&&[m.sender_id,m.recipient_id].includes(userId)&&<div className="cost-toolbar">{m.recipient_id===userId&&<button type="button" disabled={busy||loading} onClick={()=>{setReceiving(m.movement_id);setTarget('');setEditing(false);}}>{l('确认到账','Confirm receipt')}</button>}<button type="button" className="text-button" disabled={busy} onClick={()=>void act({operation:'cancel',id:m.movement_id})}>{l('取消这笔待确认转款','Cancel pending transfer')}</button></div>}
   {receiving===m.movement_id&&m.status==='pending'&&<form onSubmit={e=>{e.preventDefault();void act({operation:'confirm',id:m.movement_id,targetId:target});}}><fieldset disabled={busy}><label>{l('我的到账钱包','My receiving wallet')}<select required value={target} onChange={e=>setTarget(e.target.value)}><option value="">{l('选择实际到账钱包','Choose the wallet that received payment')}</option>{wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>{!loading&&!wallets.length&&<p className="error">{l('请先在资金资产中添加个人钱包，再回来确认到账。','Add a personal wallet in Assets, then return to confirm receipt.')}</p>}<p>{l('确认后该钱包增加','After confirmation this wallet increases by')} {formatMoney(m.amount)}{l('，不会计为收入或再增加费用。',', with no additional income or expense.')}</p><div className="cost-toolbar"><button type="submit" disabled={loading||!wallets.length}>{l('确已到账，确认结算','Confirm receipt and settlement')}</button><button type="button" className="text-button" onClick={()=>setReceiving('')}>{l('返回','Back')}</button></div></fieldset></form>}
  </div>}</PagedList>
 </div>;
}
