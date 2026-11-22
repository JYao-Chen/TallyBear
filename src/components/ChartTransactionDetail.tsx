'use client';
import { Button, ListRow, Money } from '@/ui';
import s from './ChartTransactionDetail.module.css';
import { ExpenseClaimRecord } from './ExpenseClaims';
import { Discussion } from './Discussion';
import { TransactionBalance } from './TransactionBalance';
import { CategoryIcon } from './VisualSelect';
import { useI18n } from './LanguageProvider';
import { LineItemsView } from './LineItems';
import { ReceiptAttachments } from './ReceiptAttachments';
import { accountLabel, walletOwnership, type WalletOwnership } from '@/lib/accounts';
import { displayTimestamp } from '@/lib/entry-time';

export function ChartTransactionDetail({
  row,
  money,
  onOpenSource,
  onOpenProject,
  onOpenSchedule,
}: {
  row: Record<string, any>;
  money: (amount: number) => string;
  onOpenSource?: () => void;
  onOpenProject?: () => void;
  onOpenSchedule?: () => void;
}) {
  const { t, locale } = useI18n();
  if (row.cost_row_key)
    return (
      <article className={s.detail}>
        <div className={s.amount}>
          <span>
            <CategoryIcon name={row.category} size={26} /> {row.category}
          </span>
          <Money
            size="large"
            value={Number(row.amount)}
            tone={row.kind === 'refund' ? 'income' : 'expense'}
          />
        </div>
        <p className={s.note}>{t('所选期间应承担的费用，不会再次扣减钱包。')}</p>
        <ListRow
          className={s.field}
          title={t('统计周期')}
          end={
            <>
              {row.date?.slice(0, 10)} —{' '}
              {new Date(Date.parse(row.cost_period_end) - 86400000).toISOString().slice(0, 10)}
            </>
          }
        />
        <ListRow className={s.field} title={t('记入账本')} end={row.book_name} />
        <div className={s.actions}>
          {row.source_transaction_id && onOpenSource && (
            <Button onClick={onOpenSource}>{t('打开原账单')}</Button>
          )}
          {row.cost_project_id && onOpenProject && (
            <Button onClick={onOpenProject}>{t('管理费用项目')}</Button>
          )}
          {row.source_schedule_id && onOpenSchedule && (
            <Button onClick={onOpenSchedule}>{t('管理周期计划')}</Button>
          )}
        </div>
        {row.cost_project_id && (
          <Discussion
            key={row.cost_project_id}
            target={{ kind: 'project', id: row.cost_project_id }}
            hideUnavailable
          />
        )}
      </article>
    );
  const wallet = accountLabel(
    {
      name: row.account_name || '',
      type: row.account_type,
      holder: row.account_holder,
      institution: row.account_institution,
      suffix: row.account_suffix,
      ownership: row.account_ownership,
    },
    locale,
  );
  const groups: [string, [string, unknown][]][] = [
    [
      '交易信息',
      [
        ['交易日期', row.date?.slice(0, 10)],
        ['交易时间', row.occurred_at],
        ['记入账本', row.book_name],
        ['分类', row.category],
        ['资金账户', wallet],
        [
          '钱包归属',
          row.account_ownership
            ? t(walletOwnership[row.account_ownership as WalletOwnership] || '待确认')
            : null,
        ],
        ...(row.kind === 'transfer'
          ? [
              [
                '转入账户',
                row.target_account ? accountLabel(row.target_account, locale) : row.target_name,
              ] as [string, unknown],
            ]
          : []),
      ],
    ],
    [
      '订单信息',
      [
        ['商家', row.payee],
        ['平台', row.platform],
        ['商品摘要', row.product],
        ['订单号', row.order_id],
        ['流水号', row.external_id],
        ['关联原消费编号', row.refund_of],
      ],
    ],
    [
      '记录信息',
      [
        ['记录人', row.creator_name],
        ['创建时间', displayTimestamp(row.created_at)],
        ['最后修改时间', displayTimestamp(row.updated_at)],
      ],
    ],
  ];
  return (
    <article className={s.detail}>
      <div className={s.amount}>
        <small>
          {t(
            (
              { expense: '消费支出', income: '收入', refund: '退款到账', transfer: '账户转账' } as Record<
                string,
                string
              >
            )[row.kind] || '金额',
          )}
        </small>
        <Money
          size="large"
          value={Number(row.amount)}
          tone={row.kind === 'expense' ? 'expense' : row.kind === 'transfer' ? 'plain' : 'income'}
        />
      </div>
      <TransactionBalance id={row.id} book={row.book_id} balances={row.wallet_balances} />
      {row.actual_amount != null && Number(row.actual_amount) !== Number(row.amount) && (
        <p className={s.note}>
          {t('原付款：')}
          {money(Number(row.actual_amount) / 100)}
          {t('。上方金额为尚未纳入分摊的部分。')}
        </p>
      )}
      {row.event_id && <p className={s.note}>{t('跨账本关联记录，同一笔实际收付不会重复计入钱包。')}</p>}
      {row.family_movement_id && <p className={s.note}>{t('此记录来自家庭往来。')}</p>}
      {groups.slice(0, 2).map(([title, fields]) => (
        <section key={title}>
          <h3>{t(title)}</h3>
          <div>
            {fields.map(([label, value]) => (
              <ListRow
                className={s.field}
                key={label}
                title={t(label)}
                end={value ? String(value) : t('未填写')}
              />
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>{t('商品与结算')}</h3>
        {row.line_items?.length ? (
          <LineItemsView category={row.category} items={row.line_items} total={Number(row.amount)} />
        ) : (
          <p className={s.muted}>{t('未记录商品明细')}</p>
        )}
        {row.verification_reason && (
          <p>
            {t('核验确认：')}
            {row.verification_reason}
          </p>
        )}
      </section>
      <section>
        <h3>{t('备注')}</h3>
        <p className={s.note}>{row.note || t('未填写')}</p>
      </section>
      <section>
        <h3>{t('记录信息')}</h3>
        <div>
          {groups[2][1].map(([label, value]) => (
            <ListRow
              className={s.field}
              key={label}
              title={t(label)}
              end={value ? String(value) : t('未填写')}
            />
          ))}
        </div>
      </section>
      {!row.family_movement_id && row.book_id && (
        <section>
          <h3>{t('凭证与附图')}</h3>
          <ReceiptAttachments
            key={row.id}
            book={row.book_id}
            transaction={row.id}
            allowRecognize={false}
            showEmpty
          />
        </section>
      )}
      {row.kind === 'expense' && !row.family_movement_id && row.book_id && (
        <ExpenseClaimRecord key={'claim:' + row.id} transactionId={row.id} />
      )}
      {!row.family_movement_id && row.book_id && (
        <Discussion key={row.id} target={{ kind: 'transaction', id: row.id }} hideUnavailable />
      )}
    </article>
  );
}
