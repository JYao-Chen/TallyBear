'use client';
import {useEffect,useState} from 'react';
import {useI18n} from './LanguageProvider';
import {formatMoney} from '@/lib/deployment';
export type WalletBalance={account_id:string;name:string;balance:number};
export function TransactionBalance({id,book,balances}:{id:string;book?:string;balances?:WalletBalance[]}){
 const {locale}=useI18n();const [loaded,setLoaded]=useState<WalletBalance[]|undefined>(balances);
 useEffect(()=>{setLoaded(balances);if(balances||!book)return;const c=new AbortController();fetch(`/api/books/${book}/transaction-balance?id=${encodeURIComponent(id)}`,{signal:c.signal}).then(async r=>{if(!r.ok)return [];return r.json();}).then(setLoaded).catch(()=>{});return()=>c.abort();},[id,book,balances]);
 if(!loaded?.length)return null;
 return <section className="transaction-balance-detail"><h3>{locale==='en'?'Book balance after transaction':'交易后账面余额'}</h3><dl className="detail-fields">{loaded.map(b=><div key={b.account_id}><dt>{b.name}</dt><dd>{formatMoney(b.balance)}</dd></div>)}</dl><p className="muted">{locale==='en'?'Reconstructed from wallet history, including transfers and adjustments. Entries without a time use their recording time to determine order.':'按钱包历史流水重算，包含转账与余额校正。未记录交易时间时，按录入时间确定顺序。'}</p></section>;
}
