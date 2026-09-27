'use client';
import {TransactionBalance} from './TransactionBalance';
import {useI18n} from './LanguageProvider';
import {LineItemsView} from './LineItems';
import {ReceiptAttachments} from './ReceiptAttachments';
import {accountLabel,walletOwnership,type WalletOwnership} from '@/lib/accounts';
import {displayTimestamp} from '@/lib/entry-time';

export function ChartTransactionDetail({row,money}:{row:Record<string,any>;money:(amount:number)=>string}){
 const {t,locale}=useI18n();
 if(row.cost_row_key)return <article className="chart-transaction-detail"><h3>{row.title}</h3><p>{locale==='en'?'Allocated expense for the selected period; no additional wallet debit.':'所选期间应承担的费用，不会再次扣减钱包。'}</p><strong>{money(Number(row.amount)/100)}</strong><p>{row.date?.slice(0,10)} — {new Date(Date.parse(row.cost_period_end)-86400000).toISOString().slice(0,10)}</p><p>{row.book_name} · {row.category}</p></article>;
 const wallet=accountLabel({name:row.account_name||'',type:row.account_type,holder:row.account_holder,institution:row.account_institution,suffix:row.account_suffix,ownership:row.account_ownership},locale);
 const groups:[string,[string,unknown][]][]=[
  ['交易信息',[['交易日期',row.date?.slice(0,10)],['交易时间',row.occurred_at],['记入账本',row.book_name],['分类',row.category],['资金账户',wallet],['钱包归属',row.account_ownership?t(walletOwnership[row.account_ownership as WalletOwnership]||'待确认'):null],...(row.kind==='transfer'?[['转入账户',row.target_account?accountLabel(row.target_account,locale):row.target_name] as [string,unknown]]:[])]],
  ['订单信息',[['商家',row.payee],['平台',row.platform],['商品摘要',row.product],['订单号',row.order_id],['流水号',row.external_id],['关联原消费编号',row.refund_of]]],
  ['记录信息',[['记录人',row.creator_name],['创建时间',displayTimestamp(row.created_at)],['最后修改时间',displayTimestamp(row.updated_at)]]]
 ];
 return <article className="chart-transaction-detail">
  <div className="chart-transaction-amount"><small>{t(({expense:'消费支出',income:'收入',refund:'退款到账',transfer:'账户转账'} as Record<string,string>)[row.kind]||'金额')}</small><strong className={row.kind==='expense'?'expense':row.kind==='transfer'?'':'income'}>{money(Number(row.amount)/100)}</strong></div>
  <TransactionBalance id={row.id} book={row.book_id} balances={row.wallet_balances}/>
  {row.actual_amount!=null&&Number(row.actual_amount)!==Number(row.amount)&&<p className="context-note">{locale==='en'?'Original payment: ':'原付款：'}{money(Number(row.actual_amount)/100)}{locale==='en'?'. The amount above is the portion not assigned to an allocation plan.':'。上方金额为尚未纳入分摊的部分。'}</p>}
  {row.event_id&&<p className="context-note">{t('跨账本关联记录，同一笔实际收付不会重复计入钱包。')}</p>}
  {row.family_movement_id&&<p className="context-note">{t('此记录来自家庭往来。')}</p>}
  {groups.slice(0,2).map(([title,fields])=><section key={title}><h3>{t(title)}</h3><dl className="chart-transaction-fields">{fields.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value?String(value):t('未填写')}</dd></div>)}</dl></section>)}
  <section><h3>{t('商品与结算')}</h3>{row.line_items?.length?<LineItemsView items={row.line_items} total={Number(row.amount)}/>:<p className="muted">{t('未记录商品明细')}</p>}{row.verification_reason&&<p>{t('核验确认：')}{row.verification_reason}</p>}</section>
  <section><h3>{t('备注')}</h3><p className="chart-transaction-note">{row.note||t('未填写')}</p></section>
  <section><h3>{t('记录信息')}</h3><dl className="chart-transaction-fields">{groups[2][1].map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value?String(value):t('未填写')}</dd></div>)}</dl></section>
  {!row.family_movement_id&&row.book_id&&<section><h3>{t('凭证与附图')}</h3><ReceiptAttachments key={row.id} book={row.book_id} transaction={row.id} allowRecognize={false} showEmpty/></section>}
 </article>;
}
