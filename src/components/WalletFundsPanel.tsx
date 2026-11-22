'use client';
import { FormSelect } from './FormSelect';
import { Button, Card, Field, Input, Sheet, Money } from '@/ui';
import styles from './WalletFundsPanel.module.css';
import shared from './WorkspacePlans.module.css';
import { WalletEntryActions } from './WalletEntryActions';
import { DetailSortSelect } from './DetailSortSelect';
import type { DetailSort } from '@/lib/detail-sort';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { FinanceChart } from './InteractiveFinanceChart';
import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import { deployment } from '@/lib/deployment';
import type { FundsData, FundRow } from '@/lib/wallet-funds';
export function WalletFundsPanel({
  from,
  to,
  owner = 'personal',
  walletId,
  revision,
  onChanged,
}: {
  from: string;
  to: string;
  owner?: string;
  walletId?: string;
  revision: unknown;
  onChanged?: () => void | Promise<void>;
}) {
  const [entryRevision, setEntryRevision] = useState(0);
  const [choice, setAccount] = useState('all'),
    [accounts, setAccounts] = useState<
      (AccountIdentity & { id: string; ownership: string; family_id?: string })[]
    >([]);
  const account = walletId || choice;
  useEffect(() => {
    setAccount('all');
  }, [owner]);
  useEffect(() => {
    const abort = new AbortController();
    if (walletId) return;
    fetch('/api/assets', { signal: abort.signal })
      .then(r => r.json())
      .then(rows => {
        if (!abort.signal.aborted)
          setAccounts(
            rows.filter((a: any) =>
              owner === 'personal' ? a.ownership === 'personal' : a.family_id === owner,
            ),
          );
      })
      .catch(() => {});
    return () => abort.abort();
  }, [owner, revision, entryRevision, walletId]);
  const [sort, setSort] = useState<DetailSort>('date_desc');
  const { t: tr, locale } = useI18n();
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: deployment().currency }).format(n / 100);
  const [data, setData] = useState<FundsData | null>(null),
    [query, setQuery] = useState(''),
    [flow, setFlow] = useState('all'),
    [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [detail, setDetail] = useState<FundRow | null>(null);
  const [day, setDay] = useState<string | null>(null),
    [dayData, setDayData] = useState<FundsData | null>(null),
    [daySort, setDaySort] = useState<DetailSort>('date_desc'),
    [dayOffset, setDayOffset] = useState(0),
    [dayLoading, setDayLoading] = useState(false),
    [dayError, setDayError] = useState(''),
    [dayRevision, setDayRevision] = useState(0);
  useEffect(() => {
    setOffset(0);
    setDetail(null);
    setDay(null);
    setData(null);
  }, [from, to, owner, account]);
  useEffect(() => {
    if (!day) return;
    const abort = new AbortController();
    setDayData(null);
    setDayError('');
    setDayLoading(true);
    fetch(
      '/api/assets/funds?' +
        new URLSearchParams({ from: day, to: day, owner, account, sort: daySort, offset: String(dayOffset) }),
      { signal: abort.signal },
    )
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(d => {
        if (!abort.signal.aborted) setDayData(d);
      })
      .catch(e => {
        if (!abort.signal.aborted) setDayError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setDayLoading(false);
      });
    return () => abort.abort();
  }, [day, owner, account, daySort, dayOffset, dayRevision, revision, entryRevision]);
  function openDay(point: { name: string; value: number }) {
    setDay(point.name);
    setDayOffset(0);
    setDaySort('date_desc');
    setDayData(null);
    setDayError('');
    setDetail(null);
  }

  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setLoading(true);
    const timer = setTimeout(
      () => {
        fetch(
          '/api/assets/funds?' +
            new URLSearchParams({ from, to, owner, account, sort, q: query, flow, offset: String(offset) }),
          { signal: abort.signal },
        )
          .then(async r => {
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            return d;
          })
          .then(d => {
            if (!abort.signal.aborted) setData(d);
          })
          .catch(e => {
            if (!abort.signal.aborted) {
              setError(e.message);
              setData(null);
            }
          })
          .finally(() => {
            if (!abort.signal.aborted) setLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [from, to, owner, account, sort, query, flow, offset, revision, entryRevision]);
  const label = (r: FundRow) =>
    r.repayment
      ? tr('信用账户还款')
      : r.internal
        ? tr('自有钱包互转')
        : r.kind === 'adjustment'
          ? tr('余额校准')
          : r.kind === 'transfer'
            ? tr('转账往来')
            : r.kind === 'income'
              ? tr('收入到账')
              : r.kind === 'refund'
                ? tr('退款到账')
                : tr('消费支付');
  const counterpartyLabel = (r: FundRow) =>
    r.origin === 'family' && (!r.counterparty || r.counterparty === '共同钱包')
      ? tr('共同钱包')
      : r.counterparty;
  const title = (r: FundRow) =>
    r.origin === 'family'
      ? `${r.costTitle ? r.costTitle + ' · ' : ''}${label(r)} · ${counterpartyLabel(r)}`
      : r.origin === 'adjustment'
        ? label(r)
        : r.title;
  async function deleted() {
    setDetail(null);
    setOffset(0);
    setDayOffset(0);
    setEntryRevision(v => v + 1);
    try {
      await onChanged?.();
    } catch {
      setError(tr('流水已删除，请刷新页面以更新全部统计。'));
    }
  }
  const filter = (value: string) => {
    setFlow(value);
    setOffset(0);
  };
  const s = data?.summary;
  return (
    <Card className={shared.panel + ' ' + styles.walletFunds} aria-label={tr('钱包资金流动')}>
      <header className={styles.fundsHeading}>
        <div>
          <h2>{tr('钱包资金流动')}</h2>
          <p className={shared.muted}>{tr('消费是花在了什么；资金流动是钱包实际进出多少。')}</p>
        </div>
        <small>
          {from} — {to}
        </small>
      </header>
      {!walletId && (
        <Field className={styles.fundsWalletChoice} label={tr('资金钱包')}>
          {() => (
            <FormSelect
              aria-label={tr('资金钱包')}
              value={account}
              onChange={next => {
                setAccount(next);
                setOffset(0);
              }}
            >
              <option value="all">{tr('全部钱包（现金口径）')}</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a, locale)}
                </option>
              ))}
            </FormSelect>
          )}
        </Field>
      )}
      <p className={styles.fundsScope}>
        {owner === 'personal' ? tr('本人钱包 · 跨全部账本') : tr('家庭共同钱包')} ·{' '}
        {tr('仅已确认流水，包含家庭往来；搜索只筛选下方资金明细。')}
      </p>
      {error && (
        <p className={shared.error} role="alert">
          {tr(error)}
        </p>
      )}
      {loading && !error && <p role="status">{tr('正在汇总资金流水…')}</p>}
      {data && s && (
        <>
          <div className={styles.fundsMetrics}>
            {[
              [tr('资金流入'), s.inflow, 'income', 'in'],
              [tr('资金流出'), s.outflow, 'expense', 'out'],
              [tr('现金净变化'), s.flowChange, s.flowChange < 0 ? 'expense' : 'income', 'all'],
            ].map(([name, value, cls, key]) => (
              <Button variant="primary" key={String(key)} type="button" onClick={() => filter(String(key))}>
                <span>{String(name)}</span>
                <strong className={cls === 'income' ? styles.income : shared.expense}>
                  {money(Number(value))}
                </strong>
              </Button>
            ))}
          </div>
          <dl className={styles.fundsBreakdown}>
            {[
              [tr('收入'), s.income],
              [tr('退款'), s.refund],
              [tr('转入'), s.transferIn],
              [tr('消费支付'), s.expense],
              [tr('转出'), s.transferOut],
              [tr('家庭缴款'), s.contribution],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <Money value={Number(value)} />
                </dd>
              </div>
            ))}
          </dl>
          <div className={styles.fundsBalance}>
            <span>
              {tr('期初现金余额')}
              <b>{money(s.cashOpeningBalance)}</b>
            </span>
            <span>
              {tr('余额校准')}
              <b>{money(s.cashAdjustment)}</b>
            </span>
            <span>
              {tr('期末现金余额')}
              <b>{money(s.cashClosingBalance)}</b>
            </span>
          </div>
          <p className={shared.muted + ' ' + styles.fundsNote}>
            {tr(
              '期末现金 = 期初现金 + 现金净变化 + 现金校准。信用消费只增加欠款，还款才计现金流出；自有现金钱包互转抵消。',
            )}
          </p>
          <div className={styles.fundsCharts}>
            <FinanceChart
              valueLabel={tr('资金流出')}
              chart={{
                id: 'wallet-outgoing',
                title: tr('资金流出去哪里'),
                type: 'pie',
                from,
                to,
                unit: deployment().currency,
                data: [
                  { name: tr('消费支付'), value: s.expense / 100 },
                  { name: tr('转账转出'), value: s.transferOut / 100 },
                  { name: tr('家庭缴款'), value: s.contribution / 100 },
                ].filter(d => d.value > 0),
              }}
            />
            <FinanceChart
              onSelect={openDay}
              valueLabel={tr('现金净变化')}
              chart={{
                id: 'wallet-net-flow',
                title: tr('每日资金净变化'),
                type: 'bar',
                from,
                to,
                unit: deployment().currency,
                data: data.daily.map(d => ({ name: d.date, value: (d.inflow - d.outflow) / 100 })),
              }}
            />
          </div>
          <div className={styles.fundsListHeading}>
            <h3>{tr('资金明细')}</h3>
            <small>
              {data.count} {tr('条匹配记录')}
            </small>
          </div>
        </>
      )}
      <div className={styles.fundsFilters}>
        <Field label={tr('搜索资金明细')}>
          {control => (
            <Input
              {...control}
              type="search"
              aria-label={tr('搜索资金明细')}
              placeholder={tr('名称、成员、钱包、备注、订单号')}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          )}
        </Field>
        <FormSelect aria-label={tr('资金流动类型')} value={flow} onChange={next => filter(next)}>
          {[
            ['all', '全部流水'],
            ['in', '资金流入'],
            ['out', '资金流出'],
            ['transfer', '转账往来'],
            ['repayment', '信用账户还款'],
            ['internal', '自有钱包互转'],
            ['adjustment', '余额校准'],
          ].map(([key, zh]) => (
            <option key={key} value={key}>
              {tr(zh)}
            </option>
          ))}
        </FormSelect>
      </div>
      <DetailSortSelect
        picker
        value={sort}
        onChange={v => {
          setSort(v);
          setOffset(0);
        }}
      />
      {data && !loading && (
        <>
          <div className={styles.fundsList} role="group" aria-label={tr('资金明细')}>
            {data.rows.map(r => (
              <Button variant="primary" type="button" key={r.id} onClick={() => setDetail(r)}>
                <span className={styles.fundsEntryCopy}>
                  <strong>{title(r)}</strong>
                  <small>
                    {r.date} · {label(r)} · {[r.sourceName, r.targetName].filter(Boolean).join(' → ')}
                  </small>
                </span>
                <span className={styles.fundsEntryAmount}>
                  <b className={r.delta < 0 ? shared.expense : r.delta > 0 ? styles.income : undefined}>
                    {r.internal && !r.repayment
                      ? money(r.amount)
                      : `${r.delta > 0 ? '+' : ''}${money(r.delta)}`}
                  </b>
                  {r.internal && !r.repayment && <small>{tr('合计不变')}</small>}
                </span>
                <ChevronRight size={16} />
              </Button>
            ))}
          </div>
          {!data.rows.length && <p className={shared.empty}>{tr('没有匹配的资金流水')}</p>}
          <nav className={styles.fundsPagination} aria-label={tr('资金明细分页')}>
            <Button
              variant="secondary"
              type="button"
              disabled={!offset}
              onClick={() => setOffset(v => Math.max(0, v - 20))}
            >
              {tr('上一页')}
            </Button>
            <small>
              {tr('第 {0} / {1} 页 · 共 {2} 笔', [
                Math.floor(offset / 20) + 1,
                Math.max(1, Math.ceil(data.count / 20)),
                data.count,
              ])}
            </small>
            <Button
              variant="secondary"
              type="button"
              disabled={!data.hasMore}
              onClick={() => setOffset(v => v + 20)}
            >
              {tr('下一页')}
            </Button>
          </nav>
        </>
      )}
      {(day || detail) && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={detail ? title(detail) : day!}
          onClose={() => {
            setDetail(null);
            setDay(null);
          }}
        >
          {detail ? (
            <>
              {day && (
                <Button variant="ghost" type="button" onClick={() => setDetail(null)}>
                  {tr('返回当天明细')}
                </Button>
              )}
              <div className={styles.fundsDetail}>
                <strong className={detail.delta < 0 ? shared.expense : styles.income}>
                  {money(detail.amount)}
                </strong>
                <dl>
                  {[
                    [tr('类型'), label(detail)],
                    [tr('交易日期'), detail.date],
                    [tr('资金账户'), detail.sourceName],
                    [tr('转入钱包'), detail.targetName],
                    [tr('交易对方'), counterpartyLabel(detail)],
                    [tr('实际资金流出'), money(detail.outflow)],
                    [tr('实际资金流入'), money(detail.inflow)],
                    [tr('合计余额变化'), money(detail.balanceDelta)],
                    [tr('订单／流水号'), detail.reference],
                    [tr('备注'), detail.note],
                  ]
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                <p className={shared.muted}>
                  {tr('这是已有资金流水，不会新增消费或重复扣款；其他成员的钱包余额不在此展示。')}
                </p>
                {detail.origin === 'transaction' && (
                  <WalletEntryActions key={detail.id} id={detail.id} onDeleted={deleted} />
                )}
              </div>
            </>
          ) : (
            <>
              <p className={shared.muted}>
                {tr('当天实际资金流水，与所选钱包和图表口径一致；包含收入、消费、退款和家庭往来。')}
              </p>
              <DetailSortSelect
                picker
                value={daySort}
                onChange={v => {
                  setDaySort(v);
                  setDayOffset(0);
                }}
              />
              {dayLoading ? (
                <p role="status">{tr('正在加载…')}</p>
              ) : dayError ? (
                <>
                  <p className={shared.error} role="alert">
                    {tr(dayError)}
                  </p>
                  <Button variant="secondary" type="button" onClick={() => setDayRevision(v => v + 1)}>
                    {tr('重试')}
                  </Button>
                </>
              ) : (
                dayData && (
                  <>
                    <p>
                      {tr('资金流入')} {money(dayData.summary.inflow)} · {tr('资金流出')}{' '}
                      {money(dayData.summary.outflow)}
                    </p>
                    <p>
                      <strong>
                        {tr('现金净变化')} {money(dayData.summary.flowChange)}
                      </strong>{' '}
                      · {dayData.count} {tr('笔')}
                    </p>
                    {dayData.summary.adjustment !== 0 && (
                      <p className={shared.muted}>
                        {tr('余额校准')} {money(dayData.summary.adjustment)} ·{' '}
                        {tr('单独影响账面余额，不计入图表资金净变化。')}
                      </p>
                    )}
                    <div className={styles.fundsList} role="group" aria-label={tr('资金明细')}>
                      {dayData.rows.map(r => (
                        <Button variant="primary" type="button" key={r.id} onClick={() => setDetail(r)}>
                          <span className={styles.fundsEntryCopy}>
                            <strong>{title(r)}</strong>
                            <small>
                              {r.date} · {label(r)} ·{' '}
                              {[r.sourceName, r.targetName].filter(Boolean).join(' → ')}
                            </small>
                          </span>
                          <span className={styles.fundsEntryAmount}>
                            <b
                              className={
                                r.delta < 0 ? shared.expense : r.delta > 0 ? styles.income : undefined
                              }
                            >
                              {r.internal && !r.repayment
                                ? money(r.amount)
                                : `${r.delta > 0 ? '+' : ''}${money(r.delta)}`}
                            </b>
                            {r.internal && !r.repayment && <small>{tr('合计不变')}</small>}
                          </span>
                          <ChevronRight size={16} />
                        </Button>
                      ))}
                    </div>
                    {!dayData.rows.length && <p className={shared.empty}>{tr('当天没有资金流水')}</p>}
                    <nav className={styles.fundsPagination} aria-label={tr('当天资金明细分页')}>
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={!dayOffset}
                        onClick={() => setDayOffset(v => Math.max(0, v - 20))}
                      >
                        {tr('上一页')}
                      </Button>
                      <small>
                        {tr('第 {0} / {1} 页 · 共 {2} 笔', [
                          Math.floor(dayOffset / 20) + 1,
                          Math.max(1, Math.ceil(dayData.count / 20)),
                          dayData.count,
                        ])}
                      </small>
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={!dayData.hasMore}
                        onClick={() => setDayOffset(v => v + 20)}
                      >
                        {tr('下一页')}
                      </Button>
                    </nav>
                  </>
                )
              )}
            </>
          )}
        </Sheet>
      )}
    </Card>
  );
}
