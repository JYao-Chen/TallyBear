'use client';
import {useEffect,useState} from 'react';
import {Landmark,Wallet,ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {PagedList} from './PagedList';
import {ReportPeriodPicker} from './ReportPeriodPicker';
import {FinanceChart} from './InteractiveFinanceChart';
import {deployment} from '@/lib/deployment';
import {getLocale} from '@/lib/i18n';
import {useI18n} from './LanguageProvider';
import {AccountIcon} from './VisualSelect';
import {accountLabel,type AccountIdentity} from '@/lib/accounts';
import {monthRange} from '@/lib/ledger-types';

const money=(n:number)=>new Intl.NumberFormat(getLocale(),{style:'currency',currency:deployment().currency}).format(n/100);
type Flow=AccountIdentity&{id:string;balance:number;income:number;expense:number;refund:number;transferIn:number;transferOut:number;archived:boolean};
type Data={scope:string;summary:{cashPaid:number;debtPurchases:number;bankDeposits:number;walletAndCash:number;assets:number;liabilities:number;netAssets:number;income:number;expense:number;refund:number};accounts:Flow[];sources:{kind:string;category:string;counterparty:string;amount:number;count:number}[];daily:{date:string;income:number;expense:number}[];categories:{name:string;value:number}[]};

export function AccountStatistics({month,revision,scope,scopeLabel,book}:{month:string;revision:unknown;scope:string;scopeLabel:string;book:string}){
 const {t:tr}=useI18n();
 const range=monthRange(month),[from,setFrom]=useState(range.from),[to,setTo]=useState(range.to),[data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{const next=monthRange(month);setFrom(next.from);setTo(next.to);},[month]);
 useEffect(()=>{const controller=new AbortController();setError('');setData(null);if(!from||!to||to<from){setError('请选择有效的日期范围');return;}fetch(`/api/assets/report?`+new URLSearchParams({from,to,owner:scope}),{signal:controller.signal}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error);setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[from,to,scope,revision]);
 const personal=scope==='personal',drill=personal&&book?{books:[book],scope:'personal_wallet' as const}:{};
 return <>
  <div className="panel-title asset-summary-heading"><h2>{scopeLabel}</h2><small>{personal?tr('跨全部账本'):tr('家庭共同资产')}</small></div>
  {error&&<p className="error" role="alert">{tr(error)}</p>}
  {data&&<section className="account-metrics">{[[Landmark,'银行存款',data.summary.bankDeposits],[Wallet,'零钱与现金',data.summary.walletAndCash],[ArrowUpRight,'负债',data.summary.liabilities],[ArrowDownLeft,'当前资产净值',data.summary.netAssets]].map(([Icon,label,value])=>{const I=Icon as typeof Wallet;return <article className="panel" key={tr(String(label))}><small><I size={18}/>{tr(String(label))}</small><h2>{money(Number(value))}</h2></article>;})}</section>}
  <section className="panel asset-analysis">
   <div className="panel-title"><h2>{tr('资产与收支分析')}</h2><small>{personal?tr('只统计本人钱包'):scopeLabel}</small></div>
   <ReportPeriodPicker value={{from,to}} onChange={range=>{setFrom(range.from);setTo(range.to);}}/>
   {!data&&!error&&<p role="status">{tr('正在汇总资产与收支…')}</p>}
   {data&&<>
    <div className="filtered-summary"><span>{tr('收入')}<strong className="income">{money(data.summary.income)}</strong></span><span>{tr('净支出')}<strong className="expense">{money(data.summary.expense-data.summary.refund)}</strong></span><span>{tr('现金实际支付')}<strong>{money(data.summary.cashPaid)}</strong></span><span>{tr('负债账户消费')}<strong>{money(data.summary.debtPurchases)}</strong></span><span>{tr('已退回')}{money(data.summary.refund)}</span></div>
    <div className="chart-grid asset-chart-grid">
     <FinanceChart chart={{id:'asset-balances',title:tr('钱包余额分布'),type:'pie',from,to,unit:deployment().currency,data:data.accounts.map(account=>({name:accountLabel(account),value:account.balance/100}))}}/>
     <FinanceChart chart={{id:'asset-daily-expense',title:tr('每日净支出'),type:'bar',dimension:'daily_expense',...drill,from,to,unit:deployment().currency,data:data.daily.map(day=>({name:day.date,value:day.expense/100}))}}/>
     <FinanceChart chart={{id:'asset-categories',title:tr('钱花在哪里'),type:'pie',dimension:'category',...drill,from,to,unit:deployment().currency,data:data.categories.map(category=>({name:category.name,value:category.value/100}))}}/>
     <FinanceChart chart={{id:'asset-daily-income',title:tr('每日收入'),type:'line',dimension:'daily_income',...drill,from,to,unit:deployment().currency,data:data.daily.map(day=>({name:day.date,value:day.income/100}))}}/>
    </div>
    {!data.accounts.length?<div className="empty"><p>{tr('这个范围还没有资金钱包。')}</p></div>:<>
     <h3>{tr('钱包收支与余额')}</h3>
     <PagedList items={data.accounts} resetKey={scope+from+to} container={rows=><div className="account-flow-table"><table><thead><tr>{['资金账户','收入到账','消费支出','退款到账','转入','转出','账户余额'].map(value=><th key={value}>{tr(value)}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>}>{account=><tr key={account.id}><td><AccountIcon name={account.institution||account.name} size={20}/> {accountLabel(account)}{account.archived&&<small> {tr('· 已归档')}</small>}</td>{[account.income,account.expense,account.refund,account.transferIn,account.transferOut,account.balance].map((value,index)=><td key={index}>{money(value)}</td>)}</tr>}</PagedList>
     <div className="account-source-grid">{[['income','收入来源'],['expense','支出去向'],['refund','退款来源']].map(([kind,title])=><div key={kind}><h3>{tr(title)}</h3>{data.sources.filter(source=>source.kind===kind).length?<PagedList items={data.sources.filter(source=>source.kind===kind)} resetKey={scope+from+to}>{(source,index)=><div className="account-source-row" key={index}><span><strong>{source.category}</strong><small>{source.counterparty} · {source.count}{tr('笔')}</small></span><b>{money(source.amount)}</b></div>}</PagedList>:<p className="muted">{tr('此期间暂无记录')}</p>}</div>)}</div>
    </>}
   </>}
   <></>
  </section>
 </>;
}
