'use client';
import {deployment,formatMoney,currencySymbol} from '@/lib/deployment';
import {getLocale} from '@/lib/i18n';
import {useI18n} from './LanguageProvider';
import {accountLabel} from '@/lib/accounts';
import {VisualSelect,SymbolIcon,AccountIcon,CategoryIcon,CategoryIcons} from './VisualSelect';
import {ArrowLeftRight,ChevronRight} from 'lucide-react';
import type {LedgerRow} from '@/lib/ledger-types';
const yuan=(n:number)=>new Intl.NumberFormat(getLocale(),{style:'currency',currency:deployment().currency}).format(n/100);
export function TransactionList({rows,onSelect,shared=false}:{rows:LedgerRow[];onSelect:(row:LedgerRow)=>void;shared?:boolean}){const {t:tr,locale}=useI18n();
 return <div className="transactions">{rows.map(r=><button type="button" className="transaction transaction-row" key={r.id} onClick={()=>onSelect(r)} aria-label={tr("查看{0}详情",[r.title||r.payee||r.product||r.category])}><span className="category-dot">{r.kind==='transfer'?<ArrowLeftRight size={18}/>:<CategoryIcon name={r.category} size={40}/>}</span><span className="transaction-copy"><strong>{(((r.title || r.payee) || r.product) || r.category)}</strong><small><AccountIcon name={(r.account_institution || r.account_name)} size={14}/> {r.date} · {accountLabel({name:r.account_name,type:r.account_type,holder:r.account_holder,institution:r.account_institution,suffix:r.account_suffix,ownership:r.account_ownership})}{r.kind==='transfer'&&r.target_name?(' → ' + (r.target_account?accountLabel(r.target_account):r.target_name)):''} · {r.category}{shared?(' · ' + r.creator_name):''}{r.line_items?.length?((' · ' + r.line_items.length) + tr("项明细")):''}</small>{r.kind==='refund'&&<small>{tr("退款到账 ·")}{r.refund_of?tr("已关联原消费"):tr("待关联原消费")}</small>}{r.note&&<small>{r.note}</small>}</span><strong className={r.kind==='expense'?'expense':r.kind==='transfer'?'':'income'}>{r.kind==='expense'?'−':r.kind==='transfer'?'':'+'}{yuan(r.amount)}</strong><ChevronRight size={16} className="row-chevron"/></button>)}</div>;
}
