'use client';
import { SectionTabs } from './SectionTabs';
import { DetailSortSelect } from './DetailSortSelect';
import type { DetailSort } from '@/lib/detail-sort';
import { OrganizeEntries } from './OrganizeEntries';
import type { ManagedBook } from './ManagementPages';
import { ReportPeriodPicker } from './ReportPeriodPicker';
import type { ReportRange } from '@/lib/report-period';
import { useI18n } from './LanguageProvider';
import { Button, IconButton, ChipButton, EmptyState, Input, Money, Select, Sheet, Stat } from '@/ui';
import { amountToCents } from '@/server/model';
import s from './RecordsPanel.module.css';

import { AttentionRecords } from './AttentionRecords';
import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import { CategoryFilterSelect, VisualSelect } from './VisualSelect';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SlidersHorizontal, Ellipsis, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { TransactionList } from './TransactionList';
import { monthRange, type LedgerReport, type LedgerRow } from '@/lib/ledger-types';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
export type ReportScope = 'book' | 'personal_wallet' | 'personal_expense';
export type AnalysisResult = { report: LedgerReport; from: string; to: string; query: string };
export function RecordsPanel({
  book,
  month,
  revision,
  accounts,
  categories,
  shared,
  onSelect,
  books,
  canWrite,
  onChanged,
  scope,
  onScopeChange,
  showScope = true,
  onReportChange,
  onLoadingChange,
  dateRange,
  bookIds,
  periodOnly = false,
  basis = 'period_expense',
  summary,
  overview,
  currentBook = book,
  onPeriodChange,
  onBooksChange,
  scopeControls,
  onPlans,
  onReconcile,
  initialView = 'overview',
}: {
  currentBook?: string;
  onPeriodChange?: (range: ReportRange) => void;
  onBooksChange?: (ids: string[]) => void;
  scopeControls?: ReactNode;
  onReconcile?: () => void;
  onPlans?: () => void;
  initialView?: 'overview' | 'entries';
  summary?: ReactNode;
  overview?: ReactNode;
  bookIds?: string[];
  periodOnly?: boolean;
  basis?: 'period_expense' | 'cashflow';
  onLoadingChange?: (loading: boolean) => void;
  dateRange?: ReportRange;
  books: ManagedBook[];
  canWrite: boolean;
  onChanged: () => void;
  book: string;
  month: string;
  revision: number;
  accounts: (AccountIdentity & { id: string })[];
  categories: { name: string }[];
  shared: boolean;
  onSelect: (row: LedgerRow) => void;
  scope: ReportScope;
  onScopeChange: (scope: ReportScope) => void;
  showScope?: boolean;
  onReportChange?: (value: AnalysisResult) => void;
}) {
  const { t: tr } = useI18n();
  const [view, setView] = useState<string>(initialView);
  const [sort, setSort] = useState<DetailSort>('date_desc');
  const [selecting, setSelecting] = useState(false),
    [selection, setSelection] = useState<Set<string>>(new Set());
  const [personalAccounts, setPersonalAccounts] = useState<(AccountIdentity & { id: string })[]>([]),
    [personalCategories, setPersonalCategories] = useState<{ name: string }[]>([]);
  const [restored, setRestored] = useState(0);
  const range = monthRange(month);
  const [localRange, setLocalRange] = useState(range);
  const { from, to } = dateRange || localRange;
  const [kind, setKind] = useState('all'),
    [account, setAccount] = useState('all'),
    [category, setCategory] = useState<string[]>([]),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0),
    [report, setReport] = useState<LedgerReport | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [amounts, setAmounts] = useState({ min: '', max: '' });
  const [draftAmounts, setDraftAmounts] = useState(amounts);
  const [amountError, setAmountError] = useState('');
  const entries = initialView === 'entries' && !!onPeriodChange;
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    const value = monthRange(month);
    setLocalRange(value);
    setOffset(0);
  }, [month]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const externalOptions = scope !== 'book' || (bookIds?.length || 0) > 1 || book !== currentBook;
  useEffect(() => {
    if (!externalOptions) return;
    const controller = new AbortController();
    Promise.all([
      entries ? Promise.resolve([]) : fetch('/api/assets', { signal: controller.signal }).then(r => r.json()),
      fetch('/api/search-options?book=' + (entries && bookIds?.length === 1 ? book : 'all'), {
        signal: controller.signal,
      }).then(r => r.json()),
    ])
      .then(([assetRows, options]) => {
        if (controller.signal.aborted) return;
        setPersonalAccounts(
          entries ? options.accounts || [] : assetRows.filter((a: any) => a.ownership === 'personal'),
        );
        setPersonalCategories((options.categories || []).map((name: string) => ({ name })));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [externalOptions, book, scope, bookIds?.join(','), revision, entries]);
  const queryParams = new URLSearchParams({
    from,
    to,
    sort,
    kind,
    account,
    q: search,
    offset: String(offset),
    limit: String(LIST_PAGE_SIZE),
    ...(scope !== 'book' ? { scope } : {}),
    ...(periodOnly ? { basis, view: 'expenses' } : {}),
  });
  for (const k of ['min', 'max'] as const)
    if (amounts[k]) queryParams.set(k, String(amountToCents(amounts[k])));
  category.forEach(name => queryParams.append('category', name));
  bookIds?.forEach(id => queryParams.append('book', id));
  const query = queryParams.toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    onLoadingChange?.(true);
    setReport(null);
    setError('');
    if (!from || !to || to < from) {
      setError('请选择有效的日期范围');
      setLoading(false);
      onLoadingChange?.(false);
      setReport(null);
      return;
    }
    fetch('/api/books/' + book + '/report?' + query, { signal: controller.signal })
      .then(async r => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error);
        if (controller.signal.aborted) return;
        if (offset && offset >= value.totals.count) {
          setOffset(Math.max(0, Math.floor((value.totals.count - 1) / LIST_PAGE_SIZE) * LIST_PAGE_SIZE));
          return;
        }
        setReport(value);
        onReportChange?.({ report: value, from, to, query });
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setReport(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onLoadingChange?.(false);
        }
      });
    return () => controller.abort();
  }, [book, query, revision, restored]);
  useEffect(() => {
    setOffset(0);
  }, [from, to]);
  useEffect(() => {
    setSelection(new Set());
  }, [book, query, revision, restored]);
  async function download() {
    setExporting(true);
    setError('');
    try {
      const response = await fetch('/api/books/' + book + '/export?' + query);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = tr('账本-{0}至{1}.csv', [from, to]);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const shownAccounts = externalOptions ? personalAccounts : accounts,
    shownCategories = externalOptions ? personalCategories : categories;
  const typeLabels: Record<string, string> = {
    all: '全部类型',
    expense: '消费支出',
    income: '收入',
    refund: '退款到账',
    transfer: '账户转账',
  };
  const clear = () => {
    if (onBooksChange) onBooksChange(books.map(b => b.id));
    setSelecting(false);
    setKind('all');
    setAccount('all');
    setCategory([]);
    setQ('');
    setSearch('');
    setAmounts({ min: '', max: '' });
    setDraftAmounts({ min: '', max: '' });
    setAmountError('');
    setOffset(0);
  };
  const filterFields = (
    <div className={s.fields}>
      <Select
        aria-label={tr('收支类型')}
        value={kind}
        onChange={selectedValue => {
          setKind(selectedValue.target.value);
          setOffset(0);
        }}
      >
        <option value="all">{tr('全部类型')}</option>
        <option value="expense">{tr('消费支出')}</option>
        <option value="income">{tr('收入')}</option>
        <option value="refund">{tr('退款到账')}</option>
        {!periodOnly && <option value="transfer">{tr('账户转账')}</option>}
      </Select>
      {(!periodOnly || entries) && (
        <VisualSelect
          label={tr('资金账户')}
          value={account}
          onChange={v => {
            setAccount(v);
            setOffset(0);
          }}
          options={[
            { value: 'all', label: tr('全部账户') },
            ...shownAccounts.map(a => ({
              value: a.id,
              label: accountLabel(a),
              account: true,
              accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
            })),
          ]}
        />
      )}
      <CategoryFilterSelect
        values={category}
        onChange={v => {
          setCategory(v);
          setOffset(0);
        }}
        options={shownCategories}
      />
    </div>
  );
  const list = (
    <>
      {selecting && scope === 'book' && canWrite && (!bookIds || bookIds.length === 1) && (
        <div className={s.bulk}>
          <Button
            variant="ghost"
            onClick={() => {
              setSelecting(false);
              setSelection(new Set());
            }}
          >
            {tr('退出多选')}
          </Button>
          <label className={s.check}>
            <input
              type="checkbox"
              disabled={loading || !report?.rows.some(r => !r.family_movement_id && !r.cost_row_key)}
              checked={
                !!report?.rows.some(r => !r.family_movement_id && !r.cost_row_key) &&
                report.rows
                  .filter(r => !r.family_movement_id && !r.cost_row_key)
                  .every(r => selection.has(r.id))
              }
              onChange={e =>
                setSelection(
                  new Set(
                    e.target.checked
                      ? report?.rows.filter(r => !r.family_movement_id && !r.cost_row_key).map(r => r.id)
                      : [],
                  ),
                )
              }
            />
            {tr('选择本页')}
          </label>
          <span>{tr('已选 {0} 笔', [selection.size])}</span>
          <OrganizeEntries
            book={book}
            ids={[...selection]}
            books={books}
            disabled={loading}
            onSaved={() => {
              setSelection(new Set());
              setSelecting(false);
              setRestored(v => v + 1);
              onChanged();
            }}
          />
        </div>
      )}
      {loading ? (
        <div className={s.status} role="status">
          {tr('正在查找记录…')}
        </div>
      ) : report?.rows.length ? (
        <TransactionList
          rows={report.rows}
          shared={scope !== 'book' || shared}
          showBook={scope !== 'book' || (bookIds?.length || 0) > 1}
          onSelect={onSelect}
          grouped={sort.startsWith('date')}
          selection={selecting ? selection : undefined}
          onToggle={id =>
            setSelection(old => {
              const next = new Set(old);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      ) : (
        !error && <EmptyState title={tr('这个范围内暂无记录，可以调整日期或筛选条件。')} />
      )}
      {report && report.totals.count > LIST_PAGE_SIZE && (
        <div className={s.actions}>
          <Button
            disabled={loading || offset === 0}
            onClick={() => {
              setOffset(n => Math.max(0, n - LIST_PAGE_SIZE));
              top.current?.scrollIntoView({ block: 'start' });
            }}
          >
            <ChevronLeft size={16} />
            {tr('上一页')}
          </Button>
          <span>
            {offset + 1}–{Math.min(offset + LIST_PAGE_SIZE, report.totals.count)} / {report.totals.count}
          </span>
          <Button
            disabled={loading || offset + LIST_PAGE_SIZE >= report.totals.count}
            onClick={() => {
              setOffset(n => n + LIST_PAGE_SIZE);
              top.current?.scrollIntoView({ block: 'start' });
            }}
          >
            {tr('下一页')}
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </>
  );
  const totals = report?.totals;
  const expense = totals ? totals.expense - totals.refund : 0;
  const chips: [string, string, () => void][] = [];
  if (bookIds && onBooksChange)
    for (const id of bookIds) {
      if (bookIds.length < books.length)
        chips.push([
          'book' + id,
          books.find(b => b.id === id)?.name || id,
          () => {
            onBooksChange(bookIds.length === 1 ? books.map(b => b.id) : bookIds.filter(b => b !== id));
            setAccount('all');
            setCategory([]);
            setSelecting(false);
          },
        ]);
    }
  if (kind !== 'all') chips.push(['kind', tr(typeLabels[kind]), () => setKind('all')]);
  if (account !== 'all')
    chips.push([
      'account',
      shownAccounts.find(a => a.id === account)?.name || tr('资金账户'),
      () => setAccount('all'),
    ]);
  for (const name of category)
    chips.push(['category' + name, name, () => setCategory(category.filter(c => c !== name))]);
  for (const k of ['min', 'max'] as const)
    if (amounts[k])
      chips.push([
        k,
        tr(k === 'min' ? '最低金额（元）' : '最高金额（元）') + ' ' + amounts[k],
        () => setAmounts(v => ({ ...v, [k]: '' })),
      ]);
  if (q) chips.push(['query', q, () => setQ('')]);
  const searchField = (
    <label className={s.search}>
      <Search size={18} />
      <Input
        placeholder={tr('商家、商品、备注、订单号')}
        aria-label={tr('搜索流水')}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
    </label>
  );
  return (
    <section
      id="analysis-records"
      aria-label={tr('收支明细')}
      className={overview ? s.analysisPanel : s.panel}
      ref={top}
    >
      {showScope && (
        <div className={s.actions} role="group" aria-label={tr('统计范围')}>
          <Button
            type="button"
            aria-pressed={scope === 'book'}
            onClick={() => {
              onScopeChange('book');
              setAccount('all');
              setCategory([]);
              setOffset(0);
              setSelecting(false);
            }}
          >
            {tr('当前账本')}
          </Button>
          <Button
            type="button"
            aria-pressed={scope === 'personal_wallet'}
            onClick={() => {
              onScopeChange('personal_wallet');
              setAccount('all');
              setCategory([]);
              setOffset(0);
              setSelecting(false);
            }}
          >
            {tr('我的个人钱包')}
            <small>{tr('跨全部账本')}</small>
          </Button>
        </div>
      )}
      <div className={s.toolbar}>
        {(!dateRange || onPeriodChange) && (
          <ReportPeriodPicker
            value={dateRange || localRange}
            onChange={v => {
              (onPeriodChange || setLocalRange)(v);
              setOffset(0);
            }}
          />
        )}
        {(!overview || view === 'entries') && (
          <DetailSortSelect
            value={sort}
            onChange={v => {
              setSort(v);
              setOffset(0);
            }}
          />
        )}
        {!overview && searchField}
        {overview && scopeControls}
        {(entries || overview) && (
          <Button
            className={s.filtersButton}
            aria-label={tr('筛选')}
            onClick={() => {
              setDraftAmounts(amounts);
              setAmountError('');
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal size={17} />
            <span>{tr('筛选')}</span>
          </Button>
        )}
        {(!overview || view === 'entries') && (
          <IconButton
            className={s.more}
            label={tr('更多')}
            aria-haspopup="dialog"
            onClick={() => setMore(true)}
          >
            <Ellipsis size={20} />
          </IconButton>
        )}
      </div>
      <Sheet open={more} title={tr('更多')} onClose={() => setMore(false)}>
        <div className={s.menu}>
          {scope === 'book' && (!bookIds || bookIds.length === 1) && (
            <AttentionRecords
              book={book}
              revision={revision}
              onSelect={onSelect}
              onRestored={() => setRestored(n => n + 1)}
            />
          )}
          {scope === 'book' && canWrite && (!bookIds || bookIds.length === 1) && (
            <Button
              onClick={() => {
                setSelecting(true);
                setMore(false);
              }}
            >
              {tr('批量整理')}
            </Button>
          )}
          {entries && onReconcile && (
            <Button
              onClick={() => {
                setMore(false);
                onReconcile();
              }}
            >
              {tr('智能核对账单')}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={exporting || loading || q !== search || !report?.totals.count}
            onClick={() => {
              setMore(false);
              void download();
            }}
          >
            <Download size={17} />
            {tr(exporting ? '导出中…' : '导出全部结果')}
          </Button>
        </div>
      </Sheet>
      {entries || overview ? (
        <>
          <Sheet
            open={filtersOpen}
            title={tr('筛选')}
            closeLabel={tr('关闭弹窗')}
            onClose={() => setFiltersOpen(false)}
            footer={
              <>
                <Button onClick={clear}>{tr('清除筛选')}</Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    try {
                      const min = draftAmounts.min ? amountToCents(draftAmounts.min) : 0;
                      if (draftAmounts.max && amountToCents(draftAmounts.max) < min)
                        throw new Error('最高金额不能低于最低金额');
                      if (amounts.min !== draftAmounts.min || amounts.max !== draftAmounts.max) {
                        setAmounts(draftAmounts);
                        setOffset(0);
                      }
                      setFiltersOpen(false);
                    } catch (err) {
                      setAmountError((err as Error).message);
                    }
                  }}
                >
                  {tr('完成选择')}
                </Button>
              </>
            }
          >
            <div className={s.fields}>
              {overview ? searchField : scopeControls}
              {onBooksChange && bookIds && (
                <fieldset>
                  <legend>{tr('统计账本')}</legend>
                  {books.map(b => (
                    <label key={b.id} className={s.check}>
                      <input
                        type="checkbox"
                        checked={bookIds.includes(b.id)}
                        disabled={bookIds.length === 1 && bookIds[0] === b.id}
                        onChange={e => {
                          onBooksChange(
                            e.target.checked ? [...bookIds, b.id] : bookIds.filter(id => id !== b.id),
                          );
                          setAccount('all');
                          setCategory([]);
                          setOffset(0);
                          setSelecting(false);
                        }}
                      />
                      {b.name}
                    </label>
                  ))}
                </fieldset>
              )}
              {filterFields}
              {entries &&
                (['min', 'max'] as const).map(k => (
                  <label key={k}>
                    {tr(k === 'min' ? '最低金额（元）' : '最高金额（元）')}
                    <Input
                      inputMode="decimal"
                      value={draftAmounts[k]}
                      onChange={e => setDraftAmounts(v => ({ ...v, [k]: e.target.value }))}
                    />
                  </label>
                ))}
              {amountError && (
                <p role="alert" className={s.error}>
                  {tr(amountError)}
                </p>
              )}
            </div>
          </Sheet>
          {!!chips.length && (
            <div className={s.actions}>
              {chips.map(([key, label, remove]) => (
                <ChipButton
                  className={s.removeChip}
                  key={key}
                  selected
                  aria-label={tr('移除筛选：{0}', [label])}
                  onClick={() => {
                    remove();
                    setOffset(0);
                  }}
                >
                  {label} ×
                </ChipButton>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {filterFields}
          <Button variant="ghost" onClick={clear}>
            {tr('清除筛选')}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className={s.error}>
          {tr(error)}
        </p>
      )}
      {(!periodOnly || entries) && !!report?.excludedCosts?.length && (
        <aside className={s.notice}>
          {tr('部分分摊的原账单已变化，暂按原付款统计，请在计划与分摊中重新核对。')}
          {onPlans && <Button onClick={onPlans}>{tr('前往计划与分摊')}</Button>}
        </aside>
      )}
      {!summary && (
        <>
          <div className={s.stats} aria-busy={loading} aria-label={tr('筛选结果汇总')}>
            <Stat label={tr('当期净支出')}>{totals ? <Money value={-expense} tone="signed" /> : '—'}</Stat>
            <Stat label={tr('收入')}>{totals ? <Money value={totals.income} tone="income" /> : '—'}</Stat>
            <Stat label={tr('收支结余')}>
              {totals ? <Money value={totals.income - expense} tone="signed" /> : '—'}
            </Stat>
          </div>
          {totals && (
            <small className={s.status}>
              {tr('匹配')} {totals.count} {tr('笔')} · {tr('含退款')} <Money value={totals.refund} />
            </small>
          )}
          {scope === 'personal_expense' && report?.familyContribution !== undefined && (
            <p>
              {tr('另有家庭缴款')} <Money value={report.familyContribution} />
            </p>
          )}
        </>
      )}
      {summary}
      {overview ? (
        <SectionTabs
          label={tr('分析视图')}
          value={view}
          onChange={setView}
          items={[
            { key: 'overview', label: tr('概览'), content: overview },
            { key: 'entries', label: tr('明细'), content: list },
          ]}
        />
      ) : (
        list
      )}
    </section>
  );
}
