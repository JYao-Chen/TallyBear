'use client';
import s from './BudgetPanel.module.css';
import { Button, Card, ConfirmDialog, EmptyState, Input, Money, Stat, Sheet } from '@/ui';
import { PagedList } from './PagedList';
import { formatMoney } from '@/lib/deployment';
import { useI18n } from './LanguageProvider';
import { VisualSelect } from './VisualSelect';
import { useEffect, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';

import { TransactionList } from './TransactionList';
import { useEntryDetail } from './EntryDetailContext';
import { monthRange, type LedgerReport } from '@/lib/ledger-types';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
import { amountToCents } from '@/server/model';
type Budget = { category: string; amount: number; previousCategory?: string };
const yuan = formatMoney;
function BudgetDetails({
  book,
  month,
  budget,
  canWrite,
  onEdit,
  onClose,
  revision,
}: {
  revision: number;
  book: string;
  month: string;
  budget: Budget;
  canWrite: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n(),
    openEntry = useEntryDetail();
  const [offset, setOffset] = useState(0),
    [report, setReport] = useState<LedgerReport | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError('');
    const query = new URLSearchParams({
      ...monthRange(month),
      category: budget.category,
      mode: 'exact',
      kind: 'net_expense',
      offset: String(offset),
      limit: String(LIST_PAGE_SIZE),
    });
    fetch('/api/books/' + book + '/report?' + query, { signal: controller.signal })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      })
      .then(data => {
        if (!controller.signal.aborted) setReport(data);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [book, month, budget.category, offset, retry, revision]);
  const spent = report ? report.totals.expense - report.totals.refund : 0;
  return (
    <Sheet open closeLabel={t('关闭弹窗')} title={budget.category + ' · ' + t('预算明细')} onClose={onClose}>
      <div className={s.panelTitle}>
        <p>
          {month} · {t('预算金额（元）')} {yuan(budget.amount)}
        </p>
        {canWrite && (
          <Button type="button" variant="secondary" onClick={onEdit}>
            {t('修改预算')}
          </Button>
        )}
      </div>
      <p className={s.muted}>{t('按当前账本、所选月份和预算分类统计，退款冲减消费。')}</p>
      {error ? (
        <div role="alert">
          <p className={s.error}>{t(error)}</p>
          <Button type="button" variant="secondary" onClick={() => setRetry(n => n + 1)}>
            {t('重新加载')}
          </Button>
        </div>
      ) : !report ? (
        <p role="status">{t('正在读取账单…')}</p>
      ) : (
        <>
          <p>
            {t('已消费')} <strong>{yuan(spent)}</strong> ·{' '}
            {spent > budget.amount
              ? t('已超支 ') + yuan(spent - budget.amount)
              : t('还可用 ') + yuan(budget.amount - spent)}
          </p>
          {report.rows.length ? (
            <TransactionList rows={report.rows} onSelect={row => openEntry?.(row)} />
          ) : (
            <p className={s.empty}>{t('本月此分类暂无消费。')}</p>
          )}
          {report.totals.count > LIST_PAGE_SIZE && (
            <div className={s.pagination}>
              <Button
                type="button"
                variant="secondary"
                disabled={!offset}
                onClick={() => setOffset(n => Math.max(0, n - LIST_PAGE_SIZE))}
              >
                {t('上一页')}
              </Button>
              <span>
                {offset + 1}–{Math.min(offset + LIST_PAGE_SIZE, report.totals.count)} / {report.totals.count}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={offset + LIST_PAGE_SIZE >= report.totals.count}
                onClick={() => setOffset(n => n + LIST_PAGE_SIZE)}
              >
                {t('下一页')}
              </Button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
export function BudgetPanel({
  book,
  month,
  budgets,
  spending,
  categories,
  canWrite,
  onSave,
  onDelete,
  revision = 0,
}: {
  revision?: number;
  book: string;
  month: string;
  budgets: Budget[];
  spending: { name: string; value: number }[];
  categories: string[];
  canWrite: boolean;
  onSave: (b: Budget) => Promise<void>;
  onDelete: (category: string) => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [editing, setEditing] = useState<Budget | null>(null),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Budget | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const range = monthRange(month);
  const remainingDays = Math.max(
    0,
    1 + (Date.parse(range.to) - Date.parse(today > range.from ? today : range.from)) / 86400000,
  );
  const total = budgets.reduce((sum, b) => sum + b.amount, 0);
  const used = budgets.reduce((sum, b) => sum + (spending.find(s => s.name === b.category)?.value ?? 0), 0);
  const outside = spending
    .filter(item => !budgets.some(b => b.category === item.name))
    .reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const progressColor = (spent: number, amount: number) =>
    spent > amount ? 'var(--expense)' : spent * 5 > amount * 4 ? 'var(--attention)' : 'var(--accent)';
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setOpen(false);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <div className={s.panelTitle}>
        <h2>
          {locale === 'en'
            ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
                new Date(month + '-01T12:00:00Z'),
              ) +
              ' · ' +
              tr('每月预算')
            : month.replace('-', '年') + tr('月预算')}
        </h2>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(null);
              setOpen(true);
              setError('');
            }}
          >
            <Plus size={18} />
            {tr('添加')}
          </Button>
        )}
      </div>
      {budgets.length > 0 && (
        <div className={s.summary}>
          <Stat label={tr('总预算')}>
            <Money value={total} />
          </Stat>
          <Stat label={tr('已用')}>
            <Money value={used} />
          </Stat>
          <Stat label={tr('预算剩余')}>
            <Money value={total - used} />
          </Stat>
          <Stat label={tr('整体进度')}>{total ? Math.round((100 * used) / total) + '%' : '—'}</Stat>
          <progress
            aria-label={tr('整体进度')}
            max={total || 1}
            value={Math.max(0, Math.min(used, total))}
            style={{ accentColor: progressColor(used, total) }}
          />
          {outside > 0.005 && (
            <small className={s.outside}>
              {tr('已用只计有预算的分类；其他分类本月另有支出')} {yuan(outside)}
            </small>
          )}
        </div>
      )}
      <PagedList container={rows => <div className={s.cards}>{rows}</div>} items={budgets} resetKey={month}>
        {b => {
          const spent = spending.find(s => s.name === b.category)?.value || 0;
          return (
            <Button type="button" className={s.budgetCard} key={b.category} onClick={() => setSelected(b)}>
              <div className={s.rank}>
                <strong>{b.category}</strong>
                <span>
                  {yuan(spent)} / {yuan(b.amount)} <ChevronRight size={15} />
                </span>
              </div>
              <progress
                aria-label={b.category}
                style={{
                  accentColor: progressColor(spent, b.amount),
                }}
                max={b.amount || 1}
                value={Math.max(0, Math.min(spent, b.amount || 1))}
              />
              <small className={spent > b.amount ? s.expense : undefined}>
                {spent > b.amount
                  ? tr('已超支 ') + yuan(spent - b.amount)
                  : tr('还可用 ') + yuan(b.amount - spent)}
              </small>
              {remainingDays > 0 && (
                <small>
                  {tr('剩余 {0} 天 · 日均可用', [remainingDays])}{' '}
                  <Money value={Number(BigInt(Math.max(0, b.amount - spent)) / BigInt(remainingDays))} />
                </small>
              )}
            </Button>
          );
        }}
      </PagedList>
      {!budgets.length && <EmptyState title={tr('还没有预算，添加一个分类额度开始规划。')} />}
      {selected && !open && (
        <BudgetDetails
          revision={revision}
          key={book + month + selected.category}
          book={book}
          month={month}
          budget={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setOpen(true);
            setError('');
          }}
        />
      )}
      {open && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={editing ? tr('调整分类预算') : tr('添加分类预算')}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {error && (
            <p className={s.error} role="alert">
              {tr(error)}
            </p>
          )}
          <form
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const amount = amountToCents(String(f.get('amount')));
                void run(() =>
                  onSave({
                    category: String(f.get('category')),
                    amount,
                    ...(editing ? { previousCategory: editing.category } : {}),
                  }),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              {tr('分类')}
              <VisualSelect
                name="category"
                defaultValue={editing?.category}
                options={Array.from(
                  new Set([
                    ...(editing ? [editing.category] : []),
                    ...categories,
                    ...spending.map(s => s.name),
                  ]),
                ).map(c => ({ value: c, label: c }))}
              />
            </label>
            <label>
              {tr('预算金额（元）')}
              <Input
                name="amount"
                inputMode="decimal"
                defaultValue={editing ? editing.amount / 100 : ''}
                required
              />
            </label>
            <div className={s.sheetActions}>
              {editing && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  {tr('删除预算')}
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={busy}>
                {tr('保存预算')}
              </Button>
            </div>
          </form>
        </Sheet>
      )}
      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          title={tr('删除预算')}
          confirmLabel={tr('删除预算')}
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(() => onDelete(editing.category));
          }}
        >
          {tr('确定删除“{0}”的分类预算？消费记录会保留。', [editing.category])}
        </ConfirmDialog>
      )}
    </Card>
  );
}
