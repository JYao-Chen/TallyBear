'use client';
import {useEffect,useState} from 'react';
import {Landmark,Wallet,ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {PagedList} from './PagedList';
import {DateField} from './DateField';
import {deployment} from '@/lib/deployment';
import {getLocale} from '@/lib/i18n';
import {useI18n} from './LanguageProvider';
import {AccountIcon} from './VisualSelect';
import {accountLabel,type AccountIdentity} from '@/lib/accounts';
import {monthRange} from '@/lib/ledger-types';

const money=(n:number)=>new Intl.NumberFormat(getLocale(),{style:'currency',currency:deployment().currency}).format(n/100);
type Flow=AccountIdentity&{id:string;balance:number;income:number;expense:number;refund:number;transferIn:number;transferOut:number;archived:boolean};
type Data={scope:'personal';summary:{cashPaid:number;debtPurchases:number;bankDeposits:number;walletAndCash:number;assets:number;liabilities:number;netAssets:number;income:number;expense:number;refund:number};accounts:Flow[];sources:{kind:string;category:string;counterparty:string;amount:number;count:number}[]};

export function AccountStatistics({month,revision}:{month:string;revision:unknown}){
 const {t:tr}=useI18n();
 const range=monthRange(month),[from,setFrom]=useState(range.from),[to,setTo]=useState(range.to),[data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{const r=monthRange(month);setFrom(r.from);setTo(r.to);},[month]);
 useEffect(()=>{const c=new AbortController();setError('');setData(null);if(!from||!to||to<from){setError('请选择有效的日期范围');return;}fetch(`/api/assets/report?`+new URLSearchParams({from,to}),{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[from,to,revision]);
 return <>
  <div className="panel-title"><h2>{tr('个人钱包资产')}</h2><small>{tr('跨全部账本')}</small></div>
  {error&&<p className="error" role="alert">{tr(error)}</p>}
  {data&&<section className="account-metrics">{[[Landmark,'银行存款',data.summary.bankDeposits],[Wallet,'零钱与现金',data.summary.walletAndCash],[ArrowUpRight,'负债',data.summary.liabilities],[ArrowDownLeft,'当前资产净值',data.summary.netAssets]].map(([Icon,label,value])=>{const I=Icon as typeof Wallet;return <article className="panel" key={tr(String(label))}><small><I size={18}/>{tr(String(label))}</small><h2>{money(Number(value))}</h2></article>;})}</section>}
  <section className="panel">
   <div className="panel-title"><h2>{tr('个人钱包实际收支')}</h2><small>{tr('不包含家庭共同钱包')}</small></div>
   <div className="date-range asset-date-range"><label>{tr('从')}<DateField type="date" value={from} onChange={setFrom}/></label><label>{tr('到')}<DateField type="date" value={to} onChange={setTo}/></label></div>
   {!data&&!error&&<p role="status">{tr('正在汇总个人钱包…')}</p>}
   {data&&<>
    <div className="filtered-summary"><span>{tr('收入')}<strong className="income">{money(data.summary.income)}</strong></span><span>{tr('净支出')}<strong className="expense">{money(data.summary.expense-data.summary.refund)}</strong></span><span>{tr('现金实际支付')}<strong>{money(data.summary.cashPaid)}</strong></span><span>{tr('负债账户消费')}<strong>{money(data.summary.debtPurchases)}</strong></span><span>{tr('已退回')}{money(data.summary.refund)}</span></div>
    {!data.accounts.length?<div className="empty"><p>{tr('还没有个人钱包，请先在“我的资产”中添加钱包。')}</p></div>:<>
     <PagedList items={data.accounts} resetKey={from+to} container={rows=><div className="account-flow-table"><table><thead><tr>{['资金账户','收入到账','消费支出','退款到账','转入','转出','账户余额'].map(v=><th key={v}>{tr(v)}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>}>{a=><tr key={a.id}><td><AccountIcon name={a.institution||a.name} size={20}/> {accountLabel(a)}{a.archived&&<small> {tr('· 已归档')}</small>}</td>{[a.income,a.expense,a.refund,a.transferIn,a.transferOut,a.balance].map((v,i)=><td key={i}>{money(v)}</td>)}</tr>}</PagedList>
     <div className="account-source-grid">{[['income','收入来源'],['expense','支出去向'],['refund','退款来源']].map(([kind,title])=><div key={kind}><h3>{tr(title)}</h3>{data.sources.filter(s=>s.kind===kind).length?<PagedList items={data.sources.filter(s=>s.kind===kind)} resetKey={from+to}>{(s,i)=><div className="account-source-row" key={i}><span><strong>{s.category}</strong><small>{s.counterparty} · {s.count}{tr('笔')}</small></span><b>{money(s.amount)}</b></div>}</PagedList>:<p className="muted">{tr('此期间暂无记录')}</p>}</div>)}</div>
    </>}
   </>}
   <details className="usage-help"><summary>{tr('统计口径')}</summary><p>{tr('只汇总当前用户持有的个人钱包，跨全部账本统计，不包含家庭共同钱包或其他成员钱包。余额是当前账面余额，包含已归档钱包；收支和转账按所选日期统计。账户转账不计收入或支出，退款冲减支出；同一笔交易出现在多个账本时只计算一次。')}</p><p>{tr('通过微信或支付宝使用绑定银行卡付款，请选择实际扣款银行卡。充值、提现、自有账户互转及信用卡还款记为转账，利息和手续费另记支出。')}</p></details>
  </section>
 </>;
}
