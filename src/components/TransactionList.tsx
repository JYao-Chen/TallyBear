'use client';
import { hasItemCategories, categoryAmounts } from '@/lib/item-categories';
import { deployment } from '@/lib/deployment';
import { getLocale } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';
import { accountLabel } from '@/lib/accounts';
import { AccountIcon, CategoryIcon, TransferIcon } from './VisualSelect';
import { ChevronRight } from 'lucide-react';
import type { LedgerRow } from '@/lib/ledger-types';
import s from './TransactionList.module.css';
import type { ReactNode } from 'react';
const yuan = (n: number) =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency: deployment().currency }).format(n / 100);

/** Signed amount as it affects spending: expense positive, income and refunds negative, transfers 0. */
function signed(r: LedgerRow) {
  if (r.kind === 'transfer') return 0;
  return (r.kind === 'expense' ? 1 : -1) * (r.matched_amount ?? r.amount);
}

/** Consecutive rows that share a date. Callers sorted by amount pass grouped={false}. */
export function groupByDay(rows: LedgerRow[]) {
  const groups: { date: string; rows: LedgerRow[]; expense: number; income: number }[] = [];
  for (const r of rows) {
    let g = groups.at(-1);
    if (!g || g.date !== r.date) groups.push((g = { date: r.date, rows: [], expense: 0, income: 0 }));
    g.rows.push(r);
    const v = signed(r);
    if (v > 0) g.expense += v;
    else g.income -= v;
  }
  return groups;
}

function dayLabel(date: string, locale: string, tr: (v: string) => string) {
  const d = new Date(date + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
  const sameYear = d.getFullYear() === today.getFullYear();
  const day = d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const relative = diff === 0 ? tr('今天') : diff === 1 ? tr('昨天') : '';
  return { day, weekday, relative };
}

export function TransactionRow({
  title,
  icon,
  meta,
  value,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  meta: ReactNode;
  value: ReactNode;
  onClick: () => void;
}) {
  const { t: tr } = useI18n();
  return (
    <button type="button" className={s.row} onClick={onClick} aria-label={tr('查看{0}详情', [title])}>
      <span className={s.icon} aria-hidden>
        {icon}
      </span>
      <span className={s.copy}>
        <span className={s.title}>{title}</span>
        <span className={s.meta}>{meta}</span>
      </span>
      <span className={s.value}>{value}</span>
      <ChevronRight size={16} className={s.chevron} aria-hidden />
    </button>
  );
}

export function TransactionList({
  rows,
  onSelect,
  shared = false,
  showBook = false,
  selection,
  onToggle,
  grouped = true,
}: {
  rows: LedgerRow[];
  onSelect: (row: LedgerRow) => void;
  shared?: boolean;
  showBook?: boolean;
  selection?: Set<string>;
  onToggle?: (id: string) => void;
  /** Group by day with daily totals (rows must be date-sorted). */
  grouped?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const name = (r: LedgerRow) => r.title || r.payee || r.product || r.category;
  const row = (r: LedgerRow) => {
    const v = signed(r);
    return (
      <div className={s.selectable} key={r.id}>
        {selection && !r.family_movement_id && !r.cost_row_key && (
          <input
            type="checkbox"
            aria-label={tr('选择{0}', [name(r)])}
            checked={selection.has(r.id)}
            onChange={() => onToggle?.(r.id)}
          />
        )}
        <TransactionRow
          title={name(r)}
          onClick={() => onSelect(r)}
          icon={r.kind === 'transfer' ? <TransferIcon /> : <CategoryIcon name={r.category} size={36} />}
          meta={
            <>
              <AccountIcon name={r.account_institution || r.account_name || ''} size={14} />{' '}
              {r.cost_row_key
                ? tr('当期分摊 · 不重复扣款')
                : accountLabel({
                    name: r.account_name,
                    type: r.account_type,
                    holder: r.account_holder,
                    institution: r.account_institution,
                    suffix: r.account_suffix,
                    ownership: r.account_ownership,
                  })}
              {r.kind === 'transfer' && r.target_name
                ? ' → ' + (r.target_account ? accountLabel(r.target_account) : r.target_name)
                : ''}
              {' · '}
              {hasItemCategories(r.line_items || [])
                ? (r.category_parts || categoryAmounts(r.line_items || [], r.amount, r.category))
                    .map(p => p.category)
                    .join('、')
                : r.category}
              {showBook && r.book_name ? ' · ' + r.book_name : shared ? ' · ' + r.creator_name : ''}
              {r.line_items?.length ? ' · ' + r.line_items.length + tr('项明细') : ''}
              {!grouped ? ' · ' + r.date : ''}
              {r.family_movement_id && (
                <span className={r.movement_status === 'pending' ? s.tag : undefined}>
                  {' · '}
                  {tr(
                    r.movement_status === 'pending'
                      ? '待收款确认'
                      : r.kind === 'transfer'
                        ? '家庭内部转账'
                        : '个人收支 · 家庭汇总抵消',
                  )}
                </span>
              )}
              {r.kind === 'refund' && (
                <span className={r.refund_of ? undefined : s.tag}>
                  {' · '}
                  {r.refund_of ? tr('已关联原消费') : tr('待关联原消费')}
                </span>
              )}
              {r.claim_recipient_name &&
                ' · ' + tr('{0} 付款 · {1} 认领', [r.claim_sender_name, r.claim_recipient_name])}
              {r.note ? ' · ' + r.note : ''}
            </>
          }
          value={
            <>
              <strong className={v > 0 ? s.expense : v < 0 ? s.income : undefined}>
                {v > 0 ? '−' : v < 0 ? '+' : ''}
                {yuan(Math.abs(r.matched_amount ?? r.amount))}
              </strong>
              {r.matched_amount !== undefined && r.matched_amount !== r.amount && (
                <small>
                  {tr('所选分类 · 整单')} {yuan(r.amount)}
                </small>
              )}
              {r.wallet_balances?.map(b => (
                <small key={b.account_id} title={b.name}>
                  {r.wallet_balances!.length > 1 ? b.name : tr('余额')} {yuan(b.balance)}
                </small>
              ))}
            </>
          }
        />
      </div>
    );
  };
  if (!grouped) return <div className={s.rows}>{rows.map(row)}</div>;
  return (
    <div className={s.list}>
      {groupByDay(rows).map(g => {
        const label = dayLabel(g.date, locale, tr);
        return (
          <section className={s.group} key={g.date + g.rows[0].id} aria-label={g.date}>
            <header className={s.groupHead}>
              <span>
                <strong>{typeof label === 'string' ? label : label.relative || label.day}</strong>{' '}
                {typeof label === 'string' ? '' : (label.relative ? label.day + ' ' : '') + label.weekday}
              </span>
              <span className={s.groupTotals}>
                {g.expense > 0 && (
                  <span>
                    {tr('支出')} {yuan(g.expense)}
                  </span>
                )}
                {g.income > 0 && (
                  <span>
                    {tr('收入')} {yuan(g.income)}
                  </span>
                )}
              </span>
            </header>
            <div className={s.rows}>{g.rows.map(row)}</div>
          </section>
        );
      })}
    </div>
  );
}
