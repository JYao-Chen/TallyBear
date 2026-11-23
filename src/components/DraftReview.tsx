'use client';
import styles from './DraftReview.module.css';
import { Button, Chip, ConfirmDialog, Money, Sheet } from '@/ui';
import { QuickEntry } from './QuickEntry';
import { missingEntryFields } from '@/lib/missing-entry-fields';
import { PagedList } from './PagedList';
import { verifyItemTotal } from '@/lib/line-items';
import type { EntryScene } from '@/lib/entry-scene';
import type { ManagedBook } from './ManagementPages';
import { useI18n } from './LanguageProvider';
import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import type { LineItem } from '@/lib/line-items';
import { useContext, useEffect, useRef, useState } from 'react';
import { CategoryIcon, CategoryIcons } from './VisualSelect';
import type { CategorySuggestion } from '@/lib/category-learning';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';

export type Draft = {
  installment?: import('@/lib/entry-installment').EntryInstallment | null;
  claimRecipientId?: string | null;
  preferenceSuggestions?: import('@/lib/preference-learning').PreferenceSuggestion[];
  memorySuggestions?: import('@/lib/memory').MemorySuggestion[];
  activityId?: string | null;
  categorySource?: 'explicit' | 'model';
  categorySuggestion?: CategorySuggestion;
  walletCandidates?: string[];
  walletMatch?: 'funding' | 'channel';
  receiptOrigin?: import('@/lib/receipt-origin').ReceiptOrigin;
  scene?: EntryScene;
  targetBook?: string;
  title?: string;
  photoIds?: string[];
  retainReceipts?: boolean;
  verificationReason?: string;
  attachmentIds?: string[];
  lineItems?: LineItem[];
  id: string;
  accountId: string;
  targetId?: string | null;
  kind: 'income' | 'expense' | 'transfer' | 'refund';
  amount: number;
  date: string;
  payee: string;
  category: string;
  note: string;
  externalId?: string;
  platform?: string;
  orderId?: string;
  product?: string;
  occurredAt?: string;
  source?: string;
  refundOf?: string | null;
  status?: string;
  action?: 'create' | 'skip' | 'merge';
  mergeId?: string;
  mergeVersion?: number;
  matches?: { record: Original; reason: string }[];
  refundCandidates?: Original[];
  missing?: string[];
};
export type Original = {
  id: string;
  kind: string;
  amount: number;
  date: string;
  payee: string;
  product?: string;
  version?: number;
};

export function DraftReview({
  book,
  books,
  drafts,
  setDrafts,
  accounts,
  recentCategories,
  originals,
  busy,
  onSaveOne,
  onReview,
  onSave,
  focusRequest,
}: {
  focusRequest?: { id: string; key: number };
  book: string;
  books: ManagedBook[];
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  accounts: (AccountIdentity & { id: string; family_id?: string | null })[];
  recentCategories?: string[];
  originals: Original[];
  busy: boolean;
  onSaveOne?: (d: Draft) => void;
  onReview: () => void;
  onSave: () => void;
}) {
  const { t: tr } = useI18n();
  const [filter, setFilter] = useState('all');
  const root = useRef<HTMLElement>(null);
  const categories = useContext(CategoryIcons);
  const [editingId, setEditingId] = useState('');
  const [removing, setRemoving] = useState('');
  const [changed, setChanged] = useState<Record<string, (keyof Draft)[]>>({});
  const handledFocusKey = useRef<number | null>(null);

  useEffect(() => {
    if (!focusRequest || focusRequest.key === handledFocusKey.current) return;
    if (!drafts.some(d => d.id === focusRequest.id)) return;
    handledFocusKey.current = focusRequest.key;
    setFilter('all');
    setEditingId(focusRequest.id);
    const frame = requestAnimationFrame(() =>
      root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [focusRequest, drafts]);

  const editing = drafts.find(d => d.id === editingId) || null;

  const change = (id: string, patch: Partial<Draft>) => {
    const original = drafts.find(d => d.id === id);
    const keys = (Object.keys(patch) as (keyof Draft)[]).filter(key => patch[key] !== original?.[key]);
    setChanged(old => ({ ...old, [id]: [...new Set([...(old[id] || []), ...keys])] }));
    setDrafts(
      drafts.map(d => {
        if (d.id !== id) return d;
        const next = { ...d, ...patch };
        if (keys.some(key => ['kind', 'payee', 'scene', 'title', 'product', 'lineItems'].includes(key)))
          delete next.categorySuggestion;
        return next;
      }),
    );
  };

  const missing = (d: Draft) => missingEntryFields(d, accounts);
  const incomplete = drafts.filter(d => missing(d).length);
  const needs = (d: Draft) =>
    incomplete.some(v => v.id === d.id) ||
    !!d.matches?.length ||
    d.status === 'unknown' ||
    ['mismatch', 'incomplete'].includes(verifyItemTotal(d.lineItems || [], d.amount).status);

  const filtered = drafts.filter(
    d =>
      filter === 'all' ||
      (filter === 'needs' && d.action !== 'skip' && needs(d)) ||
      (filter === 'ready' && d.action !== 'skip' && !needs(d)) ||
      (filter === 'skip' && d.action === 'skip'),
  );

  const accountName = (id: string) => {
    const acc = accounts.find(a => a.id === id);
    return acc ? accountLabel(acc) : '';
  };

  const targetBookName = (id?: string) => {
    const found = books.find(b => b.id === (id || book));
    return found ? found.name : '';
  };

  return (
    <section aria-label={tr('核对草稿')} ref={root} className={styles.review}>
      <div className={styles.head}>
        <div>
          <h2>{tr('核对小票 · {0} 笔', [drafts.length])}</h2>
          <p className={styles.muted}>{tr('点击任意草稿打开核对弹窗，确认无误后整批或单笔入账。')}</p>
        </div>
        <Button variant="secondary" disabled={busy} onClick={onReview}>
          <RotateCcw size={16} aria-hidden="true" />
          {tr('重新检查重复')}
        </Button>
      </div>

      <div className={styles.filters} role="group" aria-label={tr('草稿状态')}>
        {[
          ['all', '全部'],
          ['needs', '待核对'],
          ['ready', '可保存'],
          ['skip', '已跳过'],
        ].map(([key, label]) => {
          const count = drafts.filter(
            d =>
              key === 'all' ||
              (key === 'needs' && d.action !== 'skip' && needs(d)) ||
              (key === 'ready' && d.action !== 'skip' && !needs(d)) ||
              (key === 'skip' && d.action === 'skip'),
          ).length;
          return (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              key={key}
              disabled={busy}
              aria-pressed={filter === key}
              className={filter === key ? styles.filterActive : styles.filterChip}
              onClick={() => setFilter(key)}
            >
              {tr(label)} · {count}
            </Button>
          );
        })}
      </div>

      <div className={styles.list}>
        <PagedList items={filtered} pageSize={8} resetKey={filter}>
          {d => {
            const miss = missing(d);
            const itemCount = d.lineItems?.length || 0;
            const acc = accountName(d.accountId);
            const bName = targetBookName(d.targetBook);
            const statusTone = d.action === 'skip' ? 'neutral' : needs(d) ? 'attention' : 'income';
            const statusText =
              d.action === 'skip'
                ? tr('已跳过')
                : d.action === 'merge'
                  ? tr('补充已有记录')
                  : needs(d)
                    ? tr('待核对')
                    : tr('可保存');
            return (
              <article className={miss.length ? styles.attention : styles.card}>
                <button
                  type="button"
                  className={styles.draft}
                  disabled={busy}
                  aria-label={tr('核对草稿：{0}', [d.title || d.payee || tr('待补充的小记录')])}
                  onClick={() => setEditingId(d.id)}
                >
                  <span className={styles.leading}>
                    <CategoryIcon name={d.category} size={24} />
                  </span>
                  <span className={styles.summaryBody}>
                    <strong>{d.title || d.payee || d.product || tr('待补充的小记录')}</strong>
                    <small>
                      {[d.date, d.category, acc, bName && d.targetBook && d.targetBook !== book ? bName : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className={styles.amountCol}>
                    {d.amount ? (
                      <Money
                        value={d.amount}
                        tone={d.kind === 'expense' ? 'expense' : d.kind === 'transfer' ? 'plain' : 'income'}
                      />
                    ) : (
                      <span className={styles.missingAmount}>{tr('待补金额')}</span>
                    )}
                  </span>
                </button>

                <div className={styles.badges}>
                  <Chip tone={statusTone}>{statusText}</Chip>
                  {d.status === 'unknown' && <Chip tone="attention">{tr('待确认付款状态')}</Chip>}
                  {!!d.matches?.length && (
                    <Chip tone="attention">{tr('疑似重复 {0}', [d.matches.length])}</Chip>
                  )}
                  {itemCount > 0 && <Chip>{tr('{0} 项明细', [itemCount])}</Chip>}
                  {miss.map(k => (
                    <Chip key={k} tone="attention">
                      {tr('缺：{0}', [tr(k)])}
                    </Chip>
                  ))}
                </div>

                <div className={styles.rowActions}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setEditingId(d.id)}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {tr('核对 / 修改')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => change(d.id, { action: d.action === 'skip' ? 'create' : 'skip' })}
                  >
                    {d.action === 'skip' ? tr('恢复记账') : tr('跳过')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={tr('移除草稿')}
                    onClick={() => setRemoving(d.id)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {tr('移除')}
                  </Button>
                  {onSaveOne && d.action !== 'skip' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={
                        busy ||
                        !!miss.length ||
                        !!drafts.find(other => other.id === d.refundOf && other.action !== 'skip')
                      }
                      onClick={() => onSaveOne(d)}
                    >
                      {tr('记入')}
                    </Button>
                  )}
                </div>
              </article>
            );
          }}
        </PagedList>
        {!filtered.length && <p className={styles.muted}>{tr('当前状态没有草稿')}</p>}
      </div>

      {editing && (
        <Sheet
          open
          wide
          closeLabel={tr('关闭弹窗')}
          title={editing.title || editing.payee || tr('核对与修改草稿')}
          onClose={() => setEditingId('')}
        >
          <QuickEntry
            key={editing.id}
            book={book}
            books={books}
            categories={categories.map(c => ({ archived: false, ...c }))}
            recentCategories={recentCategories}
            reviewDraft={editing}
            editedFields={changed[editing.id]}
            localDrafts={drafts}
            accounts={accounts}
            originals={originals}
            onCancel={() => setEditingId('')}
            onSave={async item => {
              change(item.id, item);
              setEditingId('');
            }}
          />
        </Sheet>
      )}

      <ConfirmDialog
        open={!!removing}
        title={tr('移除草稿')}
        onCancel={() => setRemoving('')}
        onConfirm={() => {
          setDrafts(drafts.filter(d => d.id !== removing));
          if (editingId === removing) setEditingId('');
          setRemoving('');
        }}
      >
        {tr('确定移除这笔草稿？')}
      </ConfirmDialog>

      <div className={styles.saveBar}>
        {incomplete.length > 0 && (
          <div className={styles.incompleteTip}>
            <span>{tr('有 {0} 笔需要补全金额、日期、账户或处理方式。', [incomplete.length])}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilter('all');
                setEditingId(incomplete[0].id);
              }}
            >
              {tr('打开第一笔')}
            </Button>
          </div>
        )}
        <Button type="button" variant="primary" disabled={busy || incomplete.length > 0} onClick={onSave}>
          {tr('确认保存 · 新增 {0} 笔 / 补充 {1} 笔', [
            drafts.filter(d => !d.action || d.action === 'create').length,
            drafts.filter(d => d.action === 'merge').length,
          ])}
        </Button>
      </div>
    </section>
  );
}
