'use client';
import s from './SpendingAnalysis.module.css';
import { Button, CheckboxRow, IconButton, Money, Segmented, Sheet, Stat } from '@/ui';
import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Info } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { RecordsPanel, type AnalysisResult } from './RecordsPanel';
import { WalletFundsPanel } from './WalletFundsPanel';
import { ReportPeriodPicker } from './ReportPeriodPicker';
import { FinanceChart } from './InteractiveFinanceChart';

import { FormSelect } from './FormSelect';
import { SymbolIcon } from './VisualSelect';
import type { ManagedBook } from './ManagementPages';
import type { AccountIdentity } from '@/lib/accounts';
import { monthRange, type LedgerRow } from '@/lib/ledger-types';
import { financeQuerySchema } from '@/lib/finance-query';
import { deployment } from '@/lib/deployment';

// Operate: one accounting question, one query, one set of totals and details.
// Preserve TallyBear's cream surfaces, warm ink, green/red amounts and Lucide controls.
// First viewport: three named scopes, selection and period; totals precede charts and entries.
// Switching scope clears old figures; chart drilldowns carry the exact active filters.
// Finish: desktop/mobile, Chinese/English, behavioral review and surface documentation.
type Mode = 'book' | 'personal_expense' | 'funds';
type Props = {
  book: string;
  books: ManagedBook[];
  month: string;
  revision: number;
  accounts: (AccountIdentity & { id: string })[];
  categories: { name: string }[];
  shared: boolean;
  canWrite: boolean;
  onSelect: (row: LedgerRow) => void;
  onChanged: () => void;
  onReconcile: () => void;
  onPlans: () => void;
  initialView?: 'overview' | 'entries';
};
export function SpendingAnalysis(props: Props) {
  const { locale, t: tr } = useI18n(),
    t = tr;
  const [bookBasis, setBookBasis] = useState<'period_expense' | 'cashflow'>('period_expense');
  const [explaining, setExplaining] = useState(false);
  const [mode, setMode] = useState<Mode>('book'),
    [range, setRange] = useState(() => monthRange(props.month));
  const [selectedBooks, setSelectedBooks] = useState<string[]>([props.book]),
    [choosing, setChoosing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null),
    [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState('personal'),
    [families, setFamilies] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/families', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) setFamilies(data.items || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const availableIds = selectedBooks.filter(id => props.books.some(b => b.id === id));
  const ids = availableIds.length
    ? availableIds
    : [props.books.find(b => b.id === props.book)?.id || props.books[0]?.id].filter(
        (id): id is string => !!id,
      );
  const singleBook = ids.length === 1 ? props.books.find(book => book.id === ids[0]) : undefined;
  const basis = mode === 'personal_expense' ? 'period_expense' : mode === 'funds' ? 'cashflow' : bookBasis;
  const description =
    mode === 'book' && basis === 'cashflow'
      ? tr('按付款日汇总所选账本，多个账本里的同一笔记录只计算一次。')
      : mode === 'book'
        ? tr('按记录归属统计日常消费与当期分摊。多个账本里的同一笔记录只计算一次。')
        : mode === 'personal_expense'
          ? tr('跨账本查看本人承担的费用：日常消费按本人钱包归属，分摊按本人份额。付款人不等于费用承担人。')
          : tr('查看真实付款、收款、家庭往来和余额变化。一次付款只记录一次，分摊不会再次扣款。');
  const changeMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setResult(null);
    setLoading(true);
    setSelectedBooks(next === 'book' ? [props.book] : props.books.map(b => b.id));
  };
  const r = result?.report,
    expense = (r?.totals.expense || 0) - (r?.totals.refund || 0),
    income = r?.totals.income || 0;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: deployment().currency }).format(n / 100);
  const filters = result
    ? financeQuerySchema.parse({
        from: range.from,
        to: range.to,
        bookIds: ids,
        scope: mode === 'personal_expense' ? mode : 'books',
        basis,
        query: new URLSearchParams(result.query).get('q') || '',
        categories: new URLSearchParams(result.query).getAll('category'),
        kind: new URLSearchParams(result.query).get('kind') || 'all',
      })
    : undefined;
  const chartBase = {
    books: ids,
    filters,
    ...(mode === 'personal_expense' ? { scope: 'personal_expense' as const } : {}),
    ...range,
    unit: deployment().currency,
  };
  if (props.initialView === 'entries' && mode !== 'funds') {
    return (
      <RecordsPanel
        {...props}
        book={ids[0]}
        bookIds={ids}
        dateRange={range}
        onPeriodChange={setRange}
        onBooksChange={setSelectedBooks}
        currentBook={props.book}
        shared={ids.some(id => props.books.find(b => b.id === id)?.kind === 'shared')}
        canWrite={ids.length === 1 && props.books.find(b => b.id === ids[0])?.role !== 'viewer'}
        scope={mode}
        onScopeChange={next => changeMode(next === 'book' ? 'book' : 'personal_expense')}
        periodOnly
        showScope={false}
        scopeControls={
          <>
            <fieldset>
              <legend>{t('统计口径')}</legend>
              {(
                [
                  { key: 'book', label: '账本收支' },
                  { key: 'personal_expense', label: '我的费用' },
                  { key: 'funds', label: '钱包资金流' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="entries-scope"
                    checked={mode === key}
                    onChange={() => changeMode(key)}
                  />
                  {t(label)}
                </label>
              ))}
            </fieldset>
          </>
        }
        onPlans={props.onPlans}
      />
    );
  }
  const totals = (
    <div className={s.analysisSummary} aria-busy={loading} aria-label={tr('筛选结果汇总')}>
      {(
        [
          [tr('当期净支出'), expense, s.expense],
          [tr('收入'), income, s.income],
          [
            tr(mode === 'personal_expense' ? '收支结余（个人费用口径）' : '收支结余（账本口径）'),
            income - expense,
            '',
          ],
        ] as const
      ).map(([label, value, cls]) => (
        <Stat key={label} label={label}>
          {loading || !r ? '—' : <Money value={value} className={cls} />}
        </Stat>
      ))}
    </div>
  );
  const modeControls = (
    <Segmented<Mode>
      className={s.modes}
      value={mode}
      label={tr(locale === 'en' ? 'Accounting view' : '统计口径')}
      onChange={changeMode}
      options={[
        { value: 'book', label: tr('账本收支') },
        { value: 'personal_expense', label: tr('我的费用') },
        { value: 'funds', label: tr('钱包资金流') },
      ]}
    />
  );
  return (
    <div className={s.spendingAnalysis}>
      <div className={s.period}>
        <ReportPeriodPicker
          value={range}
          onChange={value => {
            if (value.from === range.from && value.to === range.to) return;
            setRange(value);
            setResult(null);
            setLoading(true);
          }}
        />
        {mode === 'funds' ? (
          <label>
            {tr(locale === 'en' ? 'Wallet owner' : '钱包归属')}
            <FormSelect value={owner} onChange={setOwner}>
              <option value="personal">{tr('我的个人钱包')}</option>
              {families.map(f => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </FormSelect>
          </label>
        ) : (
          <div className={s.analysisBookChoice}>
            <span>{tr('统计账本')}</span>
            <Button type="button" variant="secondary" onClick={() => setChoosing(true)}>
              {singleBook?.icon && props.books.length > 1 ? (
                <span aria-hidden="true">
                  <SymbolIcon icon={singleBook.icon} size={24} still />
                </span>
              ) : (
                <BookOpen size={17} aria-hidden="true" />
              )}
              <span>
                {ids.length === props.books.length
                  ? tr('全部可访问账本')
                  : ids.length === 1
                    ? singleBook?.name
                    : tr('已选 {0} 个账本', [ids.length])}
              </span>
              <ChevronDown size={17} />
            </Button>
          </div>
        )}

        <div className={s.basisControls}>
          <Segmented
            value={basis}
            label={tr('统计时间口径')}
            options={[
              { value: 'period_expense', label: tr('按归属期'), disabled: mode === 'funds' },
              { value: 'cashflow', label: tr('按付款日'), disabled: mode === 'personal_expense' },
            ]}
            onChange={next => {
              if (next !== basis) {
                setBookBasis(next);
                setLoading(true);
                setResult(null);
              }
            }}
          />
          <IconButton label={tr('统计口径说明')} onClick={() => setExplaining(true)}>
            <Info size={18} />
          </IconButton>
        </div>
      </div>
      <Sheet open={explaining} title={tr('统计口径说明')} onClose={() => setExplaining(false)}>
        <h3>{tr('按归属期')}</h3>
        <p>{tr('一次付清的长期费用，按实际使用期间分摊。比如年费，本月只计本月的份额。')}</p>
        <h3>{tr('按付款日')}</h3>
        <p>{tr('按实际交易日期统计。比如年费，在付款当天计入全额。')}</p>
        <p>{description}</p>
        <p className={s.analysisSummaryNote}>
          {basis === 'cashflow'
            ? tr('净支出 = 付款日的消费 − 退款；转账不计消费。')
            : tr('净支出 = 消费与当期分摊 − 退款；转账不计消费。筛选同时作用于汇总、图表、明细和导出。')}
        </p>
      </Sheet>
      {mode === 'funds' ? (
        <>
          {modeControls}
          <WalletFundsPanel
            key={owner}
            owner={owner}
            from={range.from}
            to={range.to}
            revision={props.revision}
            onChanged={props.onChanged}
          />
        </>
      ) : (
        <>
          <RecordsPanel
            initialView={props.initialView}
            scopeControls={modeControls}
            summary={
              <>
                {!!r?.excludedCosts?.length && (
                  <aside className={s.notice} role="status">
                    <strong>{tr('部分分摊需要重新核对')}</strong>
                    <p>{tr('原付款已变化，当前暂按原付款显示，不能视为完整的分摊结果。')}</p>
                    <Button type="button" variant="ghost" onClick={props.onPlans}>
                      {tr('前往计划与分摊')}
                    </Button>
                  </aside>
                )}
                {totals}
                {mode === 'personal_expense' && !loading && r?.familyContribution !== undefined && (
                  <p>
                    {tr('另有家庭缴款')} {money(r.familyContribution)}
                  </p>
                )}
              </>
            }
            overview={
              <>
                {!loading && r && (
                  <div className={s.analysisCharts} role="region" aria-label={tr('分析图表')}>
                    <FinanceChart
                      chart={{
                        ...chartBase,
                        id: 'analysis-categories',
                        title: tr(locale === 'en' ? 'Expense categories' : '费用分类'),
                        dimension: 'category',
                        type: r.categories.some(c => c.value < 0) ? 'bar' : 'pie',
                        data: r.categories.map(c => ({ name: c.name, value: c.value / 100 })),
                      }}
                    />
                    <FinanceChart
                      chart={{
                        ...chartBase,
                        id: 'analysis-daily',
                        title: tr(locale === 'en' ? 'Daily net expenses' : '每日净支出'),
                        dimension: 'daily_expense',
                        type: 'bar',
                        data: r.daily.map(d => ({ name: d.date, value: d.expense / 100 })),
                      }}
                    />
                    {income !== 0 && (
                      <FinanceChart
                        chart={{
                          ...chartBase,
                          id: 'analysis-income',
                          title: tr('每日收入'),
                          dimension: 'daily_income',
                          metric: 'income',
                          type: 'line',
                          data: r.daily.map(d => ({ name: d.date, value: d.income / 100 })),
                        }}
                      />
                    )}
                  </div>
                )}
              </>
            }
            {...props}
            book={ids[0] || props.book}
            shared={ids.some(id => props.books.find(b => b.id === id)?.kind === 'shared')}
            canWrite={ids.length === 1 && props.books.find(b => b.id === ids[0])?.role !== 'viewer'}
            key={mode + ids.join(',')}
            bookIds={ids}
            dateRange={range}
            scope={mode}
            basis={basis}
            periodOnly
            showScope={false}
            onScopeChange={() => {}}
            onLoadingChange={value => {
              setLoading(value);
              if (value) setResult(null);
            }}
            onReportChange={setResult}
          />
        </>
      )}
      {choosing && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={tr('选择统计账本')}
          onClose={() => setChoosing(false)}
          footer={
            <Button type="button" variant="primary" onClick={() => setChoosing(false)}>
              {tr('完成选择')}
            </Button>
          }
        >
          <div className={s.analysisBookOptions}>
            <CheckboxRow
              title={tr('全部可访问账本')}
              icon={<BookOpen size={19} />}
              checked={ids.length === props.books.length}
              disabled={props.books.length <= 1}
              mixed={ids.length > 0 && ids.length < props.books.length}
              onChange={e => {
                setResult(null);
                setLoading(true);
                setSelectedBooks(e.target.checked ? props.books.map(b => b.id) : [props.book]);
              }}
            />
            {props.books.map(b => (
              <CheckboxRow
                key={b.id}
                title={b.name}
                icon={b.icon ? <SymbolIcon icon={b.icon} size={26} still /> : <BookOpen size={19} />}
                description={tr(b.kind === 'private' ? '私人账本' : '共享账本')}
                checked={ids.includes(b.id)}
                disabled={ids.length === 1 && ids[0] === b.id}
                onChange={e => {
                  setResult(null);
                  setLoading(true);
                  setSelectedBooks(old =>
                    e.target.checked ? [...old, b.id] : old.filter(id => id !== b.id),
                  );
                }}
              />
            ))}
            <p className={s.analysisSummaryNote}>
              {tr('仅可选择有查看权限的账本；同一笔账的关联副本不会重复计算。')}
            </p>
          </div>
        </Sheet>
      )}
    </div>
  );
}
