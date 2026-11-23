'use client';
import { FormSelect } from './FormSelect';
import { MemoryCenter } from './MemoryCenter';
import { DateField } from './DateField';
import { formatMoney } from '@/lib/deployment';
import { useI18n } from './LanguageProvider';

import { AccountIcon, SymbolIcon } from './VisualSelect';

import { useEffect, useRef, useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  ReceiptText,
  Wallet,
  NotebookPen,
  CalendarDays,
  Tags,
  MessageCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  FolderHeart,
} from 'lucide-react';
import { Button, Input, ListRow, Money, Sheet } from '@/ui';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import s from './GlobalSearch.module.css';
import { LineItemsView } from './LineItems';
import { ReceiptAttachments } from './ReceiptAttachments';
import { amountToCents } from '@/server/model';
import type { LedgerRow } from '@/lib/ledger-types';
import { LIST_PAGE_SIZE } from '@/lib/pagination';
const kinds: Record<string, string> = {
  profile: '个人画像',
  cost_project: '费用归属与分担',
  memory: '商品与记忆',
  all: '全部内容',
  transaction: '收支订单与明细',
  account: '资金账户',
  book: '账本',
  activity: '活动账',
  category: '分类',
  schedule: '周期账单',
  template: '常用记录',
  report: '分析报告',
  conversation: '对话记录',
  budget: '预算',
};
const icons: any = {
  profile: Tags,
  memory: Tags,
  transaction: ReceiptText,
  account: Wallet,
  book: NotebookPen,
  activity: FolderHeart,
  category: Tags,
  schedule: CalendarDays,
  template: NotebookPen,
  report: FileText,
  conversation: MessageCircle,
  budget: Wallet,
};
const initial = {
  sort: 'relevance',
  q: '',
  entity: 'all',
  field: 'all',
  category: '',
  kind: 'all',
  from: '',
  to: '',
  min: '',
  max: '',
  amountScope: 'order',
  state: 'active',
  group: '',
};
export type SearchResult = {
  id: string;
  entity: string;
  title: string;
  book_id: string;
  book_name: string;
  day: string;
  money: number | null;
  category?: string;
  deleted: boolean;
  items: any[];
  detail: any;
};
export function GlobalSearch({
  book,
  books,
  onOpen = () => {},
  onNavigate = () => {},
  selection,
  exclude,
}: {
  book: string;
  books: { id: string; name: string; icon?: string; role?: string }[];
  onOpen?: (book: string, row: LedgerRow) => void;
  onNavigate?: (book: string, page: string, target?: { id: string; entity: string }) => void;
  exclude?: string;
  selection?: {
    label: string;
    onSelect: (row: SearchResult) => void;
    kind?: string;
    requireWrite?: boolean;
    purpose?: 'refund';
  };
}) {
  const { t: tr } = useI18n();
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [scope, setScope] = useState('all'),
    [filter, setFilter] = useState({
      ...initial,
      ...(selection ? { entity: 'transaction', kind: selection.kind || 'expense' } : {}),
    }),
    [query, setQuery] = useState(''),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<{
      rows: SearchResult[];
      total: number;
      groups: Record<string, number>;
      totals?: { expense: number; refund: number };
    } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [categories, setCategories] = useState<{ name: string; icon: string }[]>([]),
    [accounts, setAccounts] = useState<
      {
        id: string;
        name: string;
        institution?: string;
        type?: string;
        book_name: string;
        suffix: string;
        holder: string;
      }[]
    >([]),
    [account, setAccount] = useState('all');
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selection) return;
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [!!selection]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    setAccount('all');
  }, [scope]);
  useEffect(() => {
    if (!open) return;
    setAccounts([]);
    const c = new AbortController();
    fetch(`/api/search-options?book=${scope}`, { signal: c.signal })
      .then(r => r.json())
      .then(a => {
        if (Array.isArray(a.accounts)) {
          setAccounts(a.accounts);
          setCategories(a.categoryOptions || a.categories.map((name: string) => ({ name, icon: '🏷️' })));
        }
      })
      .catch(() => {});
    return () => c.abort();
  }, [scope, open]);
  useEffect(() => {
    if (!open || !query) return;
    const c = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/search?' + query + '&offset=' + offset, { signal: c.signal })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch(e => {
        if (!c.signal.aborted) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [open, query, offset, revision]);
  function runSearch() {
    try {
      const p = new URLSearchParams({
        ...filter,
        book: scope,
        account,
        ...(selection ? { entity: 'transaction', kind: selection.kind || 'expense', state: 'active' } : {}),
        ...(exclude ? { exclude } : {}),
        ...(selection?.purpose ? { purpose: selection.purpose } : {}),
      });
      if (!filter.group) p.delete('group');
      for (const k of ['min', 'max'] as const) {
        if (filter[k])
          p.set(
            k,
            String(filter[k].startsWith('-') ? -amountToCents(filter[k].slice(1)) : amountToCents(filter[k])),
          );
        else p.delete(k);
      }
      setOffset(0);
      setData(null);
      setQuery(p.toString());
      setRevision(n => n + 1);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(runSearch, 350);
    return () => clearTimeout(timer);
  }, [open, filter, scope, account, exclude]);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    runSearch();
  }
  const set = (key: keyof typeof initial, value: string) => setFilter(f => ({ ...f, [key]: value }));
  const activeFilterCount =
    (scope !== 'all' ? 1 : 0) +
    (account !== 'all' ? 1 : 0) +
    (!selection && filter.entity !== 'all' ? 1 : 0) +
    (filter.field !== 'all' ? 1 : 0) +
    (filter.category ? 1 : 0) +
    (!selection && filter.kind !== 'all' ? 1 : 0) +
    (filter.from ? 1 : 0) +
    (filter.to ? 1 : 0) +
    (filter.min ? 1 : 0) +
    (filter.max ? 1 : 0) +
    (filter.amountScope !== 'order' ? 1 : 0) +
    (!selection && filter.state !== 'active' ? 1 : 0);
  const groups = new Map<string, SearchResult[]>();
  for (const row of data?.rows || []) {
    const group = groups.get(row.entity);
    if (group) group.push(row);
    else groups.set(row.entity, [row]);
  }
  function moveFocus(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('summary[data-result]'));
    const index = rows.indexOf(e.target as HTMLElement);
    if (!rows.length || (e.target !== input.current && index < 0)) return;
    e.preventDefault();
    rows[
      index < 0
        ? e.key === 'ArrowDown'
          ? 0
          : rows.length - 1
        : (index + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
    ].focus();
  }
  return (
    <>
      <Button
        type="button"
        className={selection ? undefined : s.trigger}
        title={tr('搜索 · Ctrl/⌘ K')}
        aria-label={tr(selection?.label || '搜索整个账本系统')}
        onClick={() => setOpen(true)}
      >
        <Search size={21} />
        {selection && tr(selection.label)}
      </Button>
      {open &&
        createPortal(
          <Sheet
            open
            wide
            closeLabel={tr('关闭弹窗')}
            title={tr(selection?.label || '跨账本搜索')}
            onClose={() => setOpen(false)}
          >
            <div className={s.search} onKeyDown={moveFocus}>
              <form onSubmit={submit}>
                <div className={s.input}>
                  <Search size={20} />
                  <Input
                    ref={input}
                    value={filter.q}
                    onChange={e => set('q', e.target.value)}
                    placeholder={tr('商家、商品、订单号、备注、报告…')}
                    aria-label={tr('搜索关键词')}
                    maxLength={200}
                  />
                  <Button type="submit" variant="primary" disabled={loading}>
                    {tr('搜索')}
                  </Button>
                </div>
                <div className={s.toolbar}>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen(v => !v)}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    {tr('筛选条件')}
                    {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                  </Button>
                  <FormSelect
                    aria-label={tr('搜索结果排序')}
                    value={filter.sort}
                    onChange={next => set('sort', next)}
                  >
                    {[
                      ['relevance', '相关结果优先'],
                      ['date_desc', '时间 · 从新到旧'],
                      ['date_asc', '时间 · 从旧到新'],
                      ['amount_desc', '金额 · 从高到低'],
                      ['amount_asc', '金额 · 从低到高'],
                    ].map(([value, zh]) => (
                      <option key={value} value={value}>
                        {tr(zh)}
                      </option>
                    ))}
                  </FormSelect>
                </div>
                {filtersOpen && (
                  <div className={s.filters}>
                    <div className={s.fields}>
                      <label>
                        {tr('搜索范围')}
                        <FormSelect
                          value={scope}
                          onChange={next => {
                            setScope(next);
                            setData(null);
                          }}
                        >
                          <option value="all">{tr('全部可访问账本')}</option>
                          {books.map(b => (
                            <option value={b.id} key={b.id} data-icon={b.icon || '📒'}>
                              {b.name}
                              {b.id === book ? tr('（当前）') : ''}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                      <label>
                        {tr('内容类型')}
                        <FormSelect
                          disabled={!!selection}
                          value={filter.entity}
                          onChange={next => set('entity', next)}
                        >
                          {Object.entries(kinds).map(([v, n]) => (
                            <option key={v} value={v}>
                              {tr(n)}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                    </div>
                    <div className={s.fields}>
                      <label>
                        {tr('订单搜索字段')}
                        <FormSelect value={filter.field} onChange={next => set('field', next)}>
                          {Object.entries({
                            all: '全部字段',
                            payee: '商家',
                            product: '商品摘要',
                            item: '商品 / 菜品明细',
                            order: '订单号 / 流水号',
                            note: '备注',
                            platform: '商城 / 平台',
                          }).map(([v, n]) => (
                            <option key={v} value={v}>
                              {n}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                      <label>
                        {tr('分类')}
                        <FormSelect value={filter.category} onChange={next => set('category', next)}>
                          <option value="">{tr('全部分类')}</option>
                          {categories.map(c => (
                            <option key={c.name} value={c.name} data-icon={c.icon}>
                              {c.name}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                      <label>
                        {tr('收支类型')}
                        <FormSelect
                          disabled={!!selection}
                          value={filter.kind}
                          onChange={next => set('kind', next)}
                        >
                          {Object.entries({
                            all: '全部',
                            expense: '消费支出',
                            income: '收入',
                            refund: '退款',
                            transfer: '转账',
                          }).map(([v, n]) => (
                            <option key={v} value={v}>
                              {n}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                      <label>
                        {tr('开始日期')}
                        <DateField type="date" value={filter.from} onChange={v => set('from', v)} />
                      </label>
                      <label>
                        {tr('结束日期')}
                        <DateField type="date" value={filter.to} onChange={v => set('to', v)} />
                      </label>
                      <label>
                        {tr('最低金额（元）')}
                        <Input
                          inputMode="decimal"
                          value={filter.min}
                          onChange={e => set('min', e.target.value)}
                          placeholder={tr('不限')}
                        />
                      </label>
                      <label>
                        {tr('最高金额（元）')}
                        <Input
                          inputMode="decimal"
                          value={filter.max}
                          onChange={e => set('max', e.target.value)}
                          placeholder={tr('不限')}
                        />
                      </label>
                      <label>
                        {tr('金额匹配位置')}
                        <FormSelect value={filter.amountScope} onChange={next => set('amountScope', next)}>
                          <option value="order">{tr('整笔金额')}</option>
                          <option value="item">{tr('明细小计')}</option>
                          <option value="either">{tr('整笔或明细')}</option>
                        </FormSelect>
                      </label>
                      <label>
                        {tr('记录状态')}
                        <FormSelect
                          disabled={!!selection}
                          value={filter.state}
                          onChange={next => set('state', next)}
                        >
                          <option value="active">{tr('正常记录')}</option>
                          <option value="trash">{tr('已删除的交易')}</option>
                          <option value="all">{tr('包含已删除交易')}</option>
                        </FormSelect>
                      </label>
                      <label>
                        {tr('资金账户')}
                        <FormSelect value={account} onChange={next => setAccount(next)}>
                          <option value="all">{tr('全部账户')}</option>
                          {accounts.map(a => (
                            <option
                              key={a.id}
                              value={a.id}
                              data-account={[a.institution, a.name, a.type].filter(Boolean).join(' ')}
                            >
                              {a.book_name} · {a.name}
                              {a.holder ? ' · ' + a.holder : ''}
                              {a.suffix ? ' · ' + a.suffix : ''}
                            </option>
                          ))}
                        </FormSelect>
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setFilter({
                          ...initial,
                          ...(selection ? { entity: 'transaction', kind: selection.kind || 'expense' } : {}),
                        });
                        setScope('all');
                        setAccount('all');
                        setQuery('');
                        setData(null);
                        setError('');
                      }}
                    >
                      {tr('清空条件')}
                    </Button>
                    <p className={s.muted}>
                      {tr(
                        '空格分隔多个关键词时须全部命中；精确匹配不区分英文字母大小写。日期、金额等条件只返回具有对应字段的内容。明细展示在所属订单下，不重复统计为一笔交易。',
                      )}
                    </p>
                  </div>
                )}
              </form>
              <p className={s.muted}>
                {tr('当前范围：')}
                {scope === 'all' ? tr('全部可访问账本') : books.find(b => b.id === scope)?.name}
                {selection && tr(' · 选择后自动填充，仍可修改')}
              </p>
              {filter.group && (
                <Button type="button" variant="ghost" onClick={() => set('group', '')}>
                  {tr('清除同款筛选')}
                </Button>
              )}
              {error && (
                <p role="alert" className={s.error}>
                  {tr(error)}
                </p>
              )}
              {loading ? (
                <p role="status">{tr('正在搜索…')}</p>
              ) : data ? (
                <>
                  <p role="status">
                    {tr('找到')}
                    {data.total} {tr('项')}
                    {Object.entries(data.groups).map(([k, n]) => (
                      <small key={k}>
                        {' '}
                        · {tr(kinds[k])} {n}
                      </small>
                    ))}
                  </p>
                  {data.groups.transaction > 0 && data.totals && (
                    <p className={s.muted}>
                      {tr('交易结果合计')} · {tr('匹配支出')} {formatMoney(data.totals.expense)} ·{' '}
                      {tr('退款 / 返现')} {formatMoney(data.totals.refund)} · {tr('净支出')}{' '}
                      {formatMoney(data.totals.expense - data.totals.refund)}
                    </p>
                  )}
                  {!data.rows.length && <p>{tr('没有匹配内容，试试缩短关键词或放宽筛选。')}</p>}
                  {Array.from(groups, ([entity, rows]) => (
                    <section key={entity} aria-label={tr(kinds[entity])}>
                      <h3>{tr(kinds[entity])}</h3>
                      {rows.map(r => {
                        const Icon = icons[r.entity] || Search;
                        const applied = new URLSearchParams(query),
                          term = (applied.get('q') || '').toLowerCase();
                        const matches = (r.items || []).filter(i =>
                          term
                            ? applied.get('mode') === 'exact'
                              ? i.name.toLowerCase() === term
                              : term.split(/\s+/).some(t => i.name.toLowerCase().includes(t))
                            : (applied.get('min') || applied.get('max')) &&
                              applied.get('amountScope') !== 'order' &&
                              i.amount !== null &&
                              i.amount >= Number(applied.get('min') || -100000000000) &&
                              i.amount <= Number(applied.get('max') || 100000000000),
                        );
                        return (
                          <details className={s.result} key={r.entity + r.id}>
                            <summary data-result>
                              <ListRow
                                leading={
                                  <span className={s.icon} aria-hidden="true">
                                    {r.entity === 'account' ? (
                                      <AccountIcon
                                        name={[r.detail.institution, r.detail.name, r.detail.type]
                                          .filter(Boolean)
                                          .join(' ')}
                                        size={28}
                                      />
                                    ) : r.entity === 'book' ? (
                                      <SymbolIcon icon={r.detail.icon || '📒'} size={28} />
                                    ) : r.entity === 'category' ? (
                                      <SymbolIcon
                                        icon={
                                          categories.find(c => c.name === r.title)?.icon ||
                                          r.detail.icon ||
                                          '🏷️'
                                        }
                                        size={28}
                                      />
                                    ) : (
                                      <Icon size={20} />
                                    )}
                                  </span>
                                }
                                title={r.title}
                                meta={
                                  <>
                                    <span>
                                      {r.entity === 'activity'
                                        ? r.detail.familyName || tr('个人活动')
                                        : r.book_id
                                          ? r.book_name
                                          : tr(
                                              r.entity === 'cost_project'
                                                ? '费用归属与分担'
                                                : ['memory', 'profile'].includes(r.entity)
                                                  ? '个人画像'
                                                  : '资金资产',
                                            )}{' '}
                                      · {tr(kinds[r.entity])}
                                      {r.day ? ' · ' + r.day.slice(0, 10) : ''}
                                      {r.deleted ? tr(' · 已删除') : ''}
                                    </span>
                                    {matches.length > 0 && (
                                      <small>
                                        {tr('明细命中：')}
                                        {matches
                                          .slice(0, 3)
                                          .map(
                                            i =>
                                              i.name +
                                              ' ' +
                                              (i.amount === null ? tr('待补充') : formatMoney(i.amount)),
                                          )
                                          .join('、')}
                                        {matches.length > 3 ? tr(' 等') + matches.length + tr('项') : ''}
                                      </small>
                                    )}
                                  </>
                                }
                                end={
                                  r.money !== null && (
                                    <Money
                                      value={r.money}
                                      tone={
                                        r.detail.kind === 'expense'
                                          ? 'expense'
                                          : r.detail.kind === 'income' || r.detail.kind === 'refund'
                                            ? 'income'
                                            : 'plain'
                                      }
                                    />
                                  )
                                }
                              />
                            </summary>
                            <div className={s.body}>
                              {r.entity === 'transaction' ? (
                                <>
                                  <dl className={s.facts}>
                                    {[
                                      ['商家', r.detail.payee],
                                      ['资金账户', r.detail.account_name],
                                      ['分类', r.category],
                                      ['订单号', r.detail.order_id],
                                      ['流水号', r.detail.external_id],
                                      ['备注', r.detail.note],
                                    ]
                                      .filter(([, v]) => v)
                                      .map(([k, v]) => (
                                        <div key={k}>
                                          <dt>{tr(k)}</dt>
                                          <dd>{v}</dd>
                                        </div>
                                      ))}
                                  </dl>
                                  <LineItemsView items={r.items || []} total={r.money || 0} />
                                  <ReceiptAttachments book={r.book_id} transaction={r.id} />
                                  {!r.deleted &&
                                    (selection ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={selection.requireWrite && r.detail.writable === false}
                                        onClick={() => {
                                          setOpen(false);
                                          selection.onSelect(r);
                                        }}
                                      >
                                        {tr(
                                          selection.requireWrite && r.detail.writable === false
                                            ? '此账本只读'
                                            : '选择并填充',
                                        )}
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                          onOpen(r.book_id, r.detail);
                                        }}
                                      >
                                        {tr('打开这笔记录')}
                                      </Button>
                                    ))}
                                  {r.detail.kind === 'expense' && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => {
                                        setFilter({
                                          ...initial,
                                          entity: 'transaction',
                                          group: r.detail.scene?.purchaseGroup || r.id,
                                        });
                                        setScope('all');
                                        setAccount('all');
                                      }}
                                    >
                                      {tr('查看同款购买')}
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <p className={s.content}>
                                    {(r.entity === 'profile' ? '' : r.detail.content) ||
                                      r.detail.description ||
                                      [
                                        r.detail.holder,
                                        r.detail.institution,
                                        r.detail.suffix,
                                        r.detail.value?.payee,
                                        r.detail.value?.note,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                  </p>
                                  {r.items?.length > 0 && (
                                    <LineItemsView items={r.items} total={r.money || 0} />
                                  )}
                                  {['memory', 'profile'].includes(r.entity) ? (
                                    <MemoryCenter
                                      initialId={r.entity === 'profile' ? 'profile-rule:' + r.id : r.id}
                                      onOpen={() => setOpen(false)}
                                    />
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setOpen(false);
                                        onNavigate(
                                          r.book_id || book,
                                          (
                                            {
                                              cost_project: 'schedules',
                                              account: 'accounts',
                                              book: 'books',
                                              category: 'settings',
                                              schedule: 'schedules',
                                              template: 'entry',
                                              report: 'chat',
                                              conversation: 'chat',
                                              budget: 'budget',
                                              activity: 'activities',
                                            } as any
                                          )[r.entity],
                                          { id: r.id, entity: r.entity },
                                        );
                                      }}
                                    >
                                      {tr('前往')}
                                      {tr(kinds[r.entity])}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </section>
                  ))}
                  <div className={s.pagination}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={offset === 0}
                      onClick={() => setOffset(n => Math.max(0, n - LIST_PAGE_SIZE))}
                    >
                      <ChevronLeft size={16} />
                      {tr('上一页')}
                    </Button>
                    <span>
                      {data.total ? offset + 1 : 0}–{Math.min(offset + LIST_PAGE_SIZE, data.total)} /{' '}
                      {data.total}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={offset + LIST_PAGE_SIZE >= data.total}
                      onClick={() => setOffset(n => n + LIST_PAGE_SIZE)}
                    >
                      {tr('下一页')}
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </>
              ) : (
                <p className={s.muted}>{tr('输入关键词，也可以只按分类、日期或金额筛选。')}</p>
              )}
            </div>
          </Sheet>,
          document.body,
        )}
    </>
  );
}
