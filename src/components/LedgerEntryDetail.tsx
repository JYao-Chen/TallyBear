'use client';
import { categoryAmounts, hasItemCategories } from '@/lib/item-categories';
import { Trash2, Copy } from 'lucide-react';
import { SectionTabs } from './SectionTabs';
import { Button, ConfirmDialog, ListRow, Money, Sheet } from '@/ui';
import s from './LedgerEntryDetail.module.css';
import { useState, type ReactNode } from 'react';
import { ExpenseClaimRecord } from './ExpenseClaims';
import { Discussion } from './Discussion';
import { TransactionBalance } from './TransactionBalance';
import { ReceiptAttachments } from './ReceiptAttachments';
import { LineItemsView } from './LineItems';
import { AllocationEditor } from './AllocationPanel';
import { OrganizeEntries } from './OrganizeEntries';
import { AccountIcon, CategoryIcon, SymbolIcon } from './VisualSelect';
import { walletOwnership } from '@/lib/accounts';
import { displayTimestamp } from '@/lib/entry-time';
import type { LedgerRow } from '@/lib/ledger-types';
import type { ManagedBook } from './ManagementPages';
import type { Account } from './AccountsPanel';
import { useI18n } from './LanguageProvider';
export function LedgerEntryDetail({
  row,
  activityName,
  detailBook,
  books,
  accounts,
  canWrite,
  busy,
  error,
  claimEditable,
  setClaimEditable,
  onClose,
  onChanged,
  onOrganized,
  onInstallment,
  onDelete,
  onEdit,
  onCopy,
}: {
  row: LedgerRow;
  activityName?: string;
  detailBook?: ManagedBook;
  books: ManagedBook[];
  accounts: Account[];
  canWrite: boolean;
  busy: boolean;
  error: string;
  claimEditable: boolean;
  setClaimEditable: (value: boolean) => void;
  onClose: () => void;
  onChanged: () => void;
  onOrganized: () => void;
  onInstallment: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onCopy?: () => void;
}) {
  const { t: tr } = useI18n(),
    book = row.book_id || detailBook?.id || '';
  const [deleting, setDeleting] = useState(false);
  const actions =
    canWrite && (row.kind !== 'expense' || claimEditable) ? (
      <div className={s.actions}>
        <OrganizeEntries book={book} ids={[row.id]} books={books} onSaved={onOrganized} />
        <Button variant="danger" disabled={busy} onClick={() => setDeleting(true)}>
          <Trash2 size={16} />
          {tr('删除记录')}
        </Button>
        {onCopy && (
          <Button disabled={busy} onClick={onCopy}>
            <Copy size={16} />
            {tr('复制为新记录')}
          </Button>
        )}
        <Button variant="primary" disabled={busy} onClick={onEdit}>
          {tr('修改记录')}
        </Button>
      </div>
    ) : undefined;
  return (
    <Sheet open wide closeLabel={tr('关闭弹窗')} title={tr('这笔小记录')} onClose={onClose} footer={actions}>
      <ConfirmDialog
        open={deleting}
        title={tr('删除记录')}
        confirmLabel={tr('删除记录')}
        busy={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          onDelete();
        }}
      >
        {tr('确认删除「{0}」？', [row.title || row.payee || row.category])}
      </ConfirmDialog>
      {error && (
        <p className={s.error} role="alert">
          {tr(error)}
        </p>
      )}
      <LedgerEntryContent
        row={row}
        activityName={activityName}
        detailBook={detailBook}
        accounts={accounts}
        canWrite={canWrite && (row.kind !== 'expense' || claimEditable)}
        overview={
          <>
            {row.kind === 'expense' && (
              <ExpenseClaimRecord
                key={row.id}
                transactionId={row.id}
                onPermission={setClaimEditable}
                onChanged={onChanged}
              />
            )}{' '}
            {canWrite && claimEditable && row.kind === 'expense' && row.account_type === 'credit' && (
              <Button onClick={onInstallment}>{tr('建立分期计划')}</Button>
            )}
            {canWrite && claimEditable && row.kind === 'expense' && (
              <AllocationEditor
                book={book}
                id={row.id}
                version={row.version}
                amount={row.amount}
                date={row.date}
                onSaved={onChanged}
              />
            )}
            {row.kind === 'refund' && (
              <p className={s.muted}>
                {row.refund_of ? tr('已关联原消费') : tr('尚未关联原消费')} {tr('· 按到账日冲减支出')}
              </p>
            )}
          </>
        }
      />
    </Sheet>
  );
}
export function LedgerEntryContent({
  row,
  activityName,
  detailBook,
  accounts = [],
  canWrite = false,
  attachments,
  overview,
  discussion,
}: {
  overview?: ReactNode;
  discussion?: ReactNode;
  row: LedgerRow;
  activityName?: string;
  detailBook?: ManagedBook;
  accounts?: Account[];
  canWrite?: boolean;
  attachments?: ReactNode;
}) {
  const { t: tr } = useI18n(),
    [tab, setTab] = useState('overview'),
    book = row.book_id || detailBook?.id || '';
  return (
    <>
      <div role="group" aria-label={tr('金额')} className={s.hero}>
        <small>
          {row.kind === 'expense'
            ? tr('消费支出')
            : row.kind === 'refund'
              ? tr('退款到账')
              : row.kind === 'income'
                ? tr('收入')
                : tr('账户转账')}
        </small>
        <Money
          value={row.amount}
          size="large"
          tone={row.kind === 'expense' ? 'expense' : row.kind === 'transfer' ? 'plain' : 'income'}
        />
        <h3>
          <CategoryIcon name={row.category} size={26} />
          {row.title || row.payee || row.product || row.category}
        </h3>
      </div>
      <SectionTabs
        label={tr('账目详情分区')}
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: tr('概览'),
            content: (
              <>
                {row.event_id && (
                  <div className={s.notice}>
                    <p>
                      {tr(
                        '跨账本关联记录：修改金额或日期会同步到关联账本；分类、备注只改当前账本。删除只移除当前账本的记录。',
                      )}
                    </p>
                  </div>
                )}
                <div role="group" aria-label={tr('交易信息')} className={s.fields}>
                  {[
                    ['交易日期', row.date],
                    ['交易时间', row.occurred_at],
                    ['创建时间', displayTimestamp(row.created_at)],
                    ['最后修改时间', displayTimestamp(row.updated_at)],
                    ['资金账户', row.account_name],
                    [
                      '钱包归属',
                      tr(row.account_ownership ? walletOwnership[row.account_ownership] : '待确认'),
                    ],
                    [
                      '记入账本',
                      detailBook
                        ? detailBook.name + ' · ' + tr(detailBook.kind === 'shared' ? '共享账本' : '个人账本')
                        : '',
                    ],
                    [hasItemCategories(row.line_items || []) ? '未分类项默认分类' : '分类', row.category],
                    ['活动', activityName],
                    ['商家', row.payee],
                    ['平台', row.platform],
                    ['商品摘要', row.product],
                    ['订单号', row.order_id],
                    ['流水号', row.external_id],
                    ['备注', row.note],
                    ['记录人', row.creator_name],
                  ]
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <ListRow
                        key={label}
                        className={s.field}
                        title={tr(label)}
                        end={
                          label === '资金账户' ? (
                            <span className={s.entity}>
                              <AccountIcon
                                name={
                                  accounts.find(a => a.id === row.account_id)?.institution || String(value)
                                }
                                size={24}
                              />
                              {value}
                            </span>
                          ) : label === '分类' || label === '未分类项默认分类' ? (
                            <span className={s.entity}>
                              <CategoryIcon name={String(value)} size={26} />
                              {value}
                            </span>
                          ) : label === '记入账本' ? (
                            <span className={s.entity}>
                              <SymbolIcon icon={detailBook?.icon || '📒'} size={26} />
                              {value}
                            </span>
                          ) : (
                            value
                          )
                        }
                      />
                    ))}
                </div>
                {hasItemCategories(row.line_items || []) &&
                  categoryAmounts(row.line_items || [], row.amount, row.category).map(part => (
                    <ListRow key={part.category} title={part.category} end={<Money value={part.amount} />} />
                  ))}
                <TransactionBalance id={row.id} book={row.book_id || book} balances={row.wallet_balances} />
                {overview}
                {row.verification_reason && (
                  <p>
                    {tr('核验确认：')}
                    {row.verification_reason}
                  </p>
                )}
              </>
            ),
          },
          {
            key: 'items',
            label: tr('商品') + ` · ${row.line_items?.length || 0}`,
            content: (
              <>
                <LineItemsView category={row.category} items={row.line_items || []} total={row.amount} />
                {!row.line_items?.length && <p className={s.muted}>{tr('未记录商品明细')}</p>}
              </>
            ),
          },
          {
            key: 'discussion',
            label: tr('讨论'),
            content: discussion ?? (
              <Discussion key={row.id} target={{ kind: 'transaction', id: row.id }} hideUnavailable />
            ),
          },
          {
            key: 'attachments',
            label: tr('附件'),
            content: attachments ?? (
              <ReceiptAttachments book={book} transaction={row.id} canWrite={canWrite} />
            ),
          },
        ]}
      />
    </>
  );
}
