'use client';
import {Sheet} from './Sheet';
import {ExpenseClaimRecord} from './ExpenseClaims';
import {Discussion} from './Discussion';
import {TransactionBalance} from './TransactionBalance';
import {ReceiptAttachments} from './ReceiptAttachments';
import {LineItemsView} from './LineItems';
import {AllocationEditor} from './AllocationPanel';
import {OrganizeEntries} from './OrganizeEntries';
import {AccountIcon,CategoryIcon,SymbolIcon} from './VisualSelect';
import {walletOwnership} from '@/lib/accounts';
import {displayTimestamp} from '@/lib/entry-time';
import {formatMoney} from '@/lib/deployment';
import type {LedgerRow} from '@/lib/ledger-types';
import type {ManagedBook} from './ManagementPages';
import type {Account} from './AccountsPanel';
import {useI18n} from './LanguageProvider';
export function LedgerEntryDetail({row,detailBook,books,accounts,canWrite,busy,error,claimEditable,setClaimEditable,onClose,onChanged,onOrganized,onInstallment,onDelete,onEdit}:{row:LedgerRow;detailBook?:ManagedBook;books:ManagedBook[];accounts:Account[];canWrite:boolean;busy:boolean;error:string;claimEditable:boolean;setClaimEditable:(value:boolean)=>void;onClose:()=>void;onChanged:()=>void;onOrganized:()=>void;onInstallment:()=>void;onDelete:()=>void;onEdit:()=>void}){
 const {t:tr}=useI18n(),book=row.book_id||detailBook?.id||'',yuan=formatMoney;
 return <Sheet title={tr('这笔小记录')} onClose={onClose}>{error&&<p className="error" role="alert">{tr(error)}</p>}<div className="detail-amount"><small>{row.kind==='expense'?tr("消费支出"):row.kind==='refund'?tr("退款到账"):row.kind==='income'?tr("收入"):tr("账户转账")}</small><strong className={row.kind==='expense'?'expense':'income'}>{yuan(row.amount)}</strong><h3>{(((row.title || row.payee) || row.product) || row.category)}</h3></div>{row.event_id&&<div className="context-note"><p className="notice">{tr("跨账本关联记录：修改金额或日期会同步到关联账本；分类、备注只改当前账本。删除只移除当前账本的记录。")}</p></div>}<dl className="detail-fields">{[['交易日期',row.date],['交易时间',row.occurred_at],['创建时间',displayTimestamp(row.created_at)],['最后修改时间',displayTimestamp(row.updated_at)],['资金账户',row.account_name],['钱包归属',tr(row.account_ownership?walletOwnership[row.account_ownership]:'待确认')],['记入账本',detailBook?.name+' · '+tr(detailBook?.kind==='shared'?'共享账本':'个人账本')],['分类',row.category],['商家',row.payee],['平台',row.platform],['商品摘要',row.product],['订单号',row.order_id],['流水号',row.external_id],['备注',row.note],['记录人',row.creator_name]].filter(([,v])=>v).map(([label,value])=><div key={tr(label)}><dt>{tr(label)}</dt><dd>{label==='资金账户'?<span className="detail-entity"><AccountIcon name={accounts.find(a=>a.id===row.account_id)?.institution||String(value)} size={24}/>{value}</span>:label==='分类'?<span className="detail-entity"><CategoryIcon name={String(value)} size={26}/>{value}</span>:label==='记入账本'?<span className="detail-entity"><SymbolIcon icon={detailBook?.icon||'📒'} size={26}/>{value}</span>:value}</dd></div>)}</dl><TransactionBalance id={row.id} book={row.book_id||book} balances={row.wallet_balances}/><LineItemsView items={(row.line_items || [])} total={row.amount}/>{row.verification_reason&&<p>{tr("核验确认：")}{row.verification_reason}</p>}<ReceiptAttachments book={book} transaction={row.id} canWrite={canWrite}/>{row.kind==='expense'&&<ExpenseClaimRecord key={row.id} transactionId={row.id} onPermission={setClaimEditable} onChanged={onChanged}/>}<Discussion key={row.id} target={{kind:'transaction',id:row.id}} hideUnavailable/>{canWrite&&claimEditable&&row.kind==='expense'&&row.account_type==='credit'&&<button className="secondary" onClick={onInstallment}>{tr('建立分期计划')}</button>}{canWrite&&claimEditable&&row.kind==='expense'&&<AllocationEditor book={book} id={row.id} version={row.version} amount={row.amount} date={row.date} onSaved={onChanged}/>}{row.kind==='refund'&&<p className="muted">{row.refund_of?tr("已关联原消费"):tr("尚未关联原消费")} {tr("· 按到账日冲减支出")}</p>}{canWrite&&(row.kind!=='expense'||claimEditable)&&<div className="sheet-actions"><OrganizeEntries book={book} ids={[row.id]} books={books} onSaved={onOrganized}/><button className="secondary" disabled={busy} onClick={onDelete}>{tr("删除记录")}</button><button disabled={busy} onClick={onEdit}>{tr("修改记录")}</button></div>}</Sheet>;
}
