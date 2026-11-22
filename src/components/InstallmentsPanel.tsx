'use client';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Sheet,
  Money,
  Segmented,
  ListRow,
  ConfirmDialog,
  EmptyState,
} from '@/ui';
import styles from './InstallmentsPanel.module.css';
import shared from './WorkspacePlans.module.css';
import { PagedList } from './PagedList';

import { useEffect, useState } from 'react';
import { CreditCard, Plus, CalendarDays, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { DateField } from './DateField';
import { useI18n } from './LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { amountToCents } from '@/server/model';
import { deviceDateTime } from '@/lib/entry-time';
import { installmentSchedule, type InstallmentDue } from '@/lib/installments';
import { accountLabel } from '@/lib/accounts';
import type { Account } from './AccountsPanel';
import type { LedgerRow } from '@/lib/ledger-types';
type Plan = {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
  owner_name: string;
  family_id?: string;
  principal: number;
  remaining: number;
  paid: number;
  paid_fees: number;
  refunded: number;
  version: number;
  dues: (InstallmentDue & { remaining: number })[];
  schedule: InstallmentDue[];
  payments: { id: string; date: string; principal: number; fee: number; voided: boolean }[];
};
const today = () => deviceDateTime().slice(0, 10);
const cents = (s: string) => (s.trim() ? amountToCents(s) : 0);
async function api(body?: unknown) {
  const r = await fetch('/api/installments', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export function InstallmentsPanel({
  book,
  books,
  accounts,
  categories,
  seed,
  onClearSeed,
  onChanged,
  onAccounts,
}: {
  book: string;
  books: { id: string; name: string; role?: string; icon?: string }[];
  accounts: Account[];
  categories: { name: string; icon?: string; archived?: boolean }[];
  seed?: LedgerRow | null;
  onClearSeed: () => void;
  onChanged: () => Promise<void>;
  onAccounts: () => void;
}) {
  const { t: tr } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'create' | 'pay' | 'schedule' | ''>(seed ? 'create' : ''),
    [selected, setSelected] = useState<Plan | null>(null),
    [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [scope, setScope] = useState('all');
  const [name, setName] = useState(seed?.title || seed?.payee || ''),
    [amount, setAmount] = useState(seed ? String(seed.amount / 100) : ''),
    [account, setAccount] = useState(seed?.account_id || ''),
    [category, setCategory] = useState(seed?.category || categories.find(c => !c.archived)?.name || ''),
    [purchaseDate, setPurchaseDate] = useState(seed?.date || today()),
    [terms, setTerms] = useState(12),
    [firstDate, setFirstDate] = useState(today()),
    [fees, setFees] = useState('0'),
    [destination, setDestination] = useState(book),
    [allocate, setAllocate] = useState(false),
    [allocationMonths, setAllocationMonths] = useState(12),
    [allocationStart, setAllocationStart] = useState(today());
  const [formCategories, setFormCategories] = useState(categories),
    [categoryLoading, setCategoryLoading] = useState(false);
  useEffect(() => {
    if (destination === book) {
      setFormCategories(categories);
      setCategoryLoading(false);
      return;
    }
    const controller = new AbortController();
    setCategoryLoading(true);
    fetch(`/api/books/${destination}/categories`, { signal: controller.signal })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setFormCategories(data);
        setCategory(data.find((c: { archived?: boolean }) => !c.archived)?.name || '');
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoryLoading(false);
      });
    return () => controller.abort();
  }, [destination, book, categories]);
  const [principal, setPrincipal] = useState(''),
    [fee, setFee] = useState('0'),
    [paidDate, setPaidDate] = useState(today()),
    [payer, setPayer] = useState(''),
    [settle, setSettle] = useState(false),
    [custom, setCustom] = useState<InstallmentDue[] | null>(null);
  async function reload() {
    const d = await api();
    setPlans(d.plans);
  }
  useEffect(() => {
    reload()
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  function close() {
    setMode('');
    setSelected(null);
    onClearSeed();
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
      await onChanged();
      setNotice('已保存');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [confirmation, setConfirmation] = useState<{ message: string; body: unknown } | null>(null);
  const active = plans.filter(p => scope === 'all' || (scope === 'personal' ? !p.family_id : !!p.family_id));
  const debtAccounts = accounts.filter(a => a.type === 'credit' && !a.archived && a.usable !== false);
  let preview: InstallmentDue[] = [];
  try {
    preview =
      custom ||
      installmentSchedule(
        mode === 'schedule' ? selected?.remaining || 0 : cents(amount),
        terms,
        firstDate,
        cents(fees),
      );
  } catch {}
  function openPlan(p: Plan, next: 'pay' | 'schedule') {
    setSelected(p);
    setMode(next);
    setError('');
    setName(p.name);
    setDestination(book);
    setCategory(
      categories.find(c => !c.archived && /利息|手续费|金融|Interest|Fees/i.test(c.name))?.name ||
        categories.find(c => !c.archived && /^(其他|Other)$/.test(c.name))?.name ||
        categories.find(c => !c.archived)?.name ||
        '',
    );
    setFirstDate(p.dues.find(d => d.remaining > 0)?.date || today());
    setTerms(p.dues.filter(d => d.remaining > 0).length || 1);
    setFees('0');
    setCustom(null);
    setSettle(false);
    setPrincipal(
      String(Math.min(p.remaining, p.dues.find(d => d.remaining > 0)?.remaining || p.remaining) / 100),
    );
    setFee('0');
    setPaidDate(today());
    setRequestId(crypto.randomUUID());
    setPayer(accounts.find(a => !a.archived && a.usable !== false && a.type !== 'credit')?.id || '');
  }
  return (
    <Card className={shared.panel}>
      <div className={shared.heading}>
        <h2>
          <CreditCard size={22} />
          {tr('分期与还款')}
        </h2>
        <Button
          variant="primary"
          onClick={() => {
            onClearSeed();
            setSelected(null);
            setName('');
            setAmount('');
            setAccount(debtAccounts[0]?.id || '');
            setPurchaseDate(today());
            setMode('create');
            setRequestId(crypto.randomUUID());
            setCustom(null);
            setAllocate(false);
          }}
        >
          <Plus size={18} />
          {tr('新增分期')}
        </Button>
      </div>
      <div className={styles.installmentSummary}>
        {[
          ['剩余本金', active.reduce((n, p) => n + p.remaining, 0)],
          ['已还本金', active.reduce((n, p) => n + p.paid, 0)],
          ['已付利息与手续费', active.reduce((n, p) => n + p.paid_fees, 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{tr(String(label))}</small>
            <strong>{formatMoney(Number(value))}</strong>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Segmented
          value={scope}
          onChange={setScope}
          label={tr('资产归属')}
          options={['all', 'personal', 'family'].map((value, i) => ({
            value,
            label: tr(['全部', '个人', '家庭共有'][i]),
          }))}
        />
        <Button variant="primary" onClick={onAccounts}>
          {tr('管理负债账户')}
        </Button>
      </div>
      {error && !mode && (
        <p className={shared.error} role="alert">
          {tr(error)}
        </p>
      )}
      {notice && !mode && <p role="status">{tr(notice)}</p>}
      {loading ? (
        <p>{tr('正在读取…')}</p>
      ) : !active.length ? (
        <EmptyState title={tr('还没有分期计划')}>{tr('使用负债账户记录购买，再按实际金额还款。')}</EmptyState>
      ) : (
        <div className={styles.installmentList}>
          {
            <PagedList items={active} resetKey={scope}>
              {p => {
                const completed = p.dues.filter(d => d.remaining === 0).length;
                const nextDue = p.dues.find(d => d.remaining > 0);
                return (
                  <article key={p.id} className={styles.installmentCard}>
                    <ListRow
                      title={p.name}
                      meta={
                        <>
                          {p.account_name} · {p.owner_name}
                        </>
                      }
                      end={<Money value={p.remaining} />}
                      endMeta={p.remaining ? tr('剩余本金') : tr('本金已结清')}
                    />
                    <div className={styles.progressLabel}>
                      <span>{p.remaining ? tr('还款中') : tr('本金已结清')}</span>
                      <span>
                        {tr('已还期数')} {completed} / {p.dues.length}
                      </span>
                    </div>
                    <progress
                      className={styles.progress}
                      aria-label={tr('已还期数')}
                      max={p.dues.length || 1}
                      value={completed}
                    />
                    {nextDue && (
                      <small>
                        {tr('下次还款日')} {nextDue.date}
                      </small>
                    )}
                    <small>
                      {tr('原始本金')} {formatMoney(p.principal)} · {tr('已退回负债账户')}{' '}
                      {formatMoney(p.refunded)}
                    </small>
                    <div className={shared.actions}>
                      <Button variant="primary" onClick={() => openPlan(p, 'pay')}>
                        <ArrowRightLeft size={16} />
                        {tr('登记还款')}
                      </Button>
                      {p.remaining > 0 && (
                        <Button variant="secondary" onClick={() => openPlan(p, 'schedule')}>
                          {tr('调整后续计划')}
                        </Button>
                      )}
                    </div>
                    <details>
                      <summary>{tr('查看还款计划')}</summary>
                      <div className={styles.installmentDues}>
                        {
                          <PagedList items={p.dues.filter(d => d.remaining > 0)}>
                            {(d, i) => (
                              <div className={shared.pair} key={i}>
                                <span>
                                  <CalendarDays size={15} /> {d.date}
                                  {d.date < today() && (
                                    <small className={shared.expense}> {tr('待核对')}</small>
                                  )}
                                </span>
                                <span>
                                  {formatMoney(d.remaining)}
                                  <small>
                                    {' '}
                                    + {formatMoney(d.fee)} {tr('预计费用')}
                                  </small>
                                </span>
                              </div>
                            )}
                          </PagedList>
                        }
                        {!p.remaining && (
                          <p>
                            <CheckCircle2 size={16} /> {tr('后续本金无需再还，费用以实际结清账单为准。')}
                          </p>
                        )}
                      </div>
                    </details>
                    <details>
                      <summary>{tr('实际还款记录')}</summary>
                      {p.payments.length ? (
                        <PagedList items={p.payments}>
                          {r => (
                            <div className={styles.installmentPayment} key={r.id}>
                              <div>
                                {r.date}
                                <small>
                                  {tr('本金')} {formatMoney(r.principal)} · {tr('费用')} {formatMoney(r.fee)}
                                </small>
                              </div>
                              {r.voided ? (
                                <span>{tr('已撤销')}</span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    setConfirmation({
                                      message: '撤销后恢复钱包和负债余额，是否继续？',
                                      body: {
                                        operation: 'void',
                                        id: p.id,
                                        version: p.version,
                                        paymentId: r.id,
                                      },
                                    });
                                  }}
                                >
                                  {tr('撤销还款')}
                                </Button>
                              )}
                            </div>
                          )}
                        </PagedList>
                      ) : (
                        <p>{tr('尚无实际还款')}</p>
                      )}
                    </details>
                    <details className={styles.contextDetails}>
                      <summary>{tr('更多操作')}</summary>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setConfirmation({
                            message: '仅移除分期计划，原消费和费用分摊仍然保留。',
                            body: { operation: 'delete', id: p.id, version: p.version },
                          });
                        }}
                      >
                        {tr('移除计划')}
                      </Button>
                    </details>
                  </article>
                );
              }}
            </PagedList>
          }
        </div>
      )}

      {confirmation && (
        <ConfirmDialog
          open
          busy={busy}
          title={tr('确认操作')}
          onCancel={() => {
            if (!busy) setConfirmation(null);
          }}
          onConfirm={() =>
            run(async () => {
              await api(confirmation.body);
              setConfirmation(null);
            })
          }
        >
          <p>{tr(confirmation.message)}</p>
          {error && <p role="alert">{tr(error)}</p>}
        </ConfirmDialog>
      )}
      {mode && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={tr(mode === 'create' ? '新增分期' : mode === 'pay' ? '登记实际还款' : '调整后续计划')}
          onClose={close}
          wide
        >
          <form
            className={styles.installmentForm}
            onSubmit={e => {
              e.preventDefault();
              run(async () => {
                if (mode === 'create') {
                  await api({
                    operation: 'create',
                    requestId,
                    book: destination,
                    name,
                    transactionId: seed?.id,
                    purchase: seed
                      ? undefined
                      : {
                          accountId: account,
                          amount: cents(amount),
                          date: purchaseDate,
                          title: name,
                          payee: name,
                          category,
                          occurredAt: deviceDateTime().slice(11),
                        },
                    terms,
                    firstDate,
                    fees: cents(fees),
                    allocate,
                    allocationStart,
                    allocationMonths,
                  });
                }
                if (mode === 'schedule')
                  await api({
                    operation: 'schedule',
                    id: selected!.id,
                    version: selected!.version,
                    name,
                    terms,
                    firstDate,
                    fees: cents(fees),
                    schedule: custom || undefined,
                  });
                if (mode === 'pay')
                  await api({
                    operation: 'pay',
                    id: selected!.id,
                    version: selected!.version,
                    requestId,
                    book: destination,
                    accountId: payer,
                    date: paidDate,
                    principal: cents(principal),
                    fee: cents(fee),
                    feeCategory: category,
                    settle,
                  });
                close();
              });
            }}
          >
            {error && (
              <p className={shared.error} role="alert">
                {tr(error)}
              </p>
            )}
            {mode !== 'pay' ? (
              <>
                <Field label={tr('分期名称')}>
                  {control => (
                    <Input
                      {...control}
                      required
                      value={name}
                      maxLength={80}
                      onChange={e => setName(e.target.value)}
                    />
                  )}
                </Field>
                {mode === 'create' && (
                  <>
                    {seed ? (
                      <p className={shared.notice}>
                        {tr('关联已有消费')}：{seed.title || seed.payee} · {formatMoney(seed.amount)}
                      </p>
                    ) : (
                      <div className={shared.grid}>
                        <Field label={tr('购买金额')}>
                          {control => (
                            <Input
                              {...control}
                              required
                              className={shared.numeric}
                              inputMode="decimal"
                              value={amount}
                              onChange={e => setAmount(e.target.value)}
                            />
                          )}
                        </Field>
                        <label>
                          {tr('购买日期')}
                          <DateField type="date" value={purchaseDate} onChange={setPurchaseDate} />
                        </label>
                        <Field label={tr('负债账户')}>
                          {control => (
                            <Select
                              {...control}
                              value={account}
                              onChange={e => setAccount(e.target.value)}
                              required
                            >
                              <option value="">{tr('请选择')}</option>
                              {debtAccounts.map(a => (
                                <option
                                  key={a.id}
                                  value={a.id}
                                  data-account={[a.institution, a.name, a.type].filter(Boolean).join(' ')}
                                >
                                  {accountLabel(a)}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Field>
                        <Field label={tr('消费分类')}>
                          {control => (
                            <Select {...control} value={category} onChange={e => setCategory(e.target.value)}>
                              {formCategories
                                .filter(c => !c.archived)
                                .map(c => (
                                  <option key={c.name} data-icon={c.icon}>
                                    {c.name}
                                  </option>
                                ))}
                            </Select>
                          )}
                        </Field>
                      </div>
                    )}
                    {!debtAccounts.length && (
                      <p className={shared.error}>
                        {tr('请先在资金资产中建立信用卡／白条／花呗负债账户，初始余额无需包含本次新购买。')}
                      </p>
                    )}
                  </>
                )}
                <div className={shared.grid}>
                  <Field label={tr('剩余期数')}>
                    {control => (
                      <Input
                        {...control}
                        type="number"
                        min={1}
                        max={600}
                        required
                        value={terms}
                        onChange={e => {
                          setTerms(Number(e.target.value));
                          setCustom(null);
                        }}
                      />
                    )}
                  </Field>
                  <label>
                    {tr('首次还款日')}
                    <DateField
                      type="date"
                      value={firstDate}
                      onChange={v => {
                        setFirstDate(v);
                        setCustom(null);
                      }}
                    />
                  </label>
                  <Field label={tr('预计剩余总费用')}>
                    {control => (
                      <Input
                        {...control}
                        className={shared.numeric}
                        inputMode="decimal"
                        value={fees}
                        onChange={e => {
                          setFees(e.target.value);
                          setCustom(null);
                        }}
                      />
                    )}
                  </Field>
                </div>
                <details open={mode === 'schedule'}>
                  <summary>{tr('各期本金与费用预览')}</summary>
                  <div className={styles.installmentPreview}>
                    {
                      <PagedList items={preview}>
                        {(r, i) => (
                          <div className={styles.dueEdit} key={i}>
                            <span>{i + 1}</span>
                            {mode === 'schedule' ? (
                              <>
                                <DateField
                                  type="date"
                                  value={r.date}
                                  onChange={date =>
                                    setCustom(preview.map((x, j) => (j === i ? { ...x, date } : x)))
                                  }
                                />
                                <Field
                                  className={styles.installmentPrincipal}
                                  label={<span>{tr('本金')}</span>}
                                >
                                  {control => (
                                    <Input
                                      {...control}
                                      aria-label={tr('本金')}
                                      className={shared.numeric}
                                      inputMode="decimal"
                                      defaultValue={r.principal / 100}
                                      key={r.principal}
                                      onBlur={e => {
                                        try {
                                          setCustom(
                                            preview.map((x, j) =>
                                              j === i ? { ...x, principal: cents(e.target.value) } : x,
                                            ),
                                          );
                                        } catch (e) {
                                          setError((e as Error).message);
                                        }
                                      }}
                                    />
                                  )}
                                </Field>
                                <Field className={styles.installmentFee} label={<span>{tr('费用')}</span>}>
                                  {control => (
                                    <Input
                                      {...control}
                                      aria-label={tr('费用')}
                                      className={shared.numeric}
                                      inputMode="decimal"
                                      defaultValue={r.fee / 100}
                                      key={'fee' + r.fee}
                                      onBlur={e => {
                                        try {
                                          setCustom(
                                            preview.map((x, j) =>
                                              j === i ? { ...x, fee: cents(e.target.value) } : x,
                                            ),
                                          );
                                        } catch (e) {
                                          setError((e as Error).message);
                                        }
                                      }}
                                    />
                                  )}
                                </Field>
                              </>
                            ) : (
                              <>
                                <span>{r.date}</span>
                                <span>{formatMoney(r.principal)}</span>
                                <small>+ {formatMoney(r.fee)}</small>
                              </>
                            )}
                          </div>
                        )}
                      </PagedList>
                    }
                  </div>
                </details>
                {mode === 'create' && (
                  <details className={styles.contextDetails}>
                    <summary>{tr('费用分摊（独立设置）')}</summary>
                    <label className={shared.check}>
                      <input
                        type="checkbox"
                        checked={allocate}
                        onChange={e => setAllocate(e.target.checked)}
                      />
                      {tr('将购买成本按月展示')}
                    </label>
                    {allocate && (
                      <div className={shared.grid}>
                        <label>
                          {tr('分摊开始月份')}
                          <DateField
                            type="month"
                            value={allocationStart.slice(0, 7)}
                            onChange={v => setAllocationStart(v + '-01')}
                          />
                        </label>
                        <Field label={tr('成本覆盖月数')}>
                          {control => (
                            <Input
                              {...control}
                              type="number"
                              min={1}
                              max={1200}
                              value={allocationMonths}
                              onChange={e => setAllocationMonths(Number(e.target.value))}
                            />
                          )}
                        </Field>
                      </div>
                    )}
                    <p>{tr('成本覆盖期可与还款期数不同，提前结清不会缩短成本分摊。')}</p>
                  </details>
                )}
              </>
            ) : (
              <>
                <h3>{selected?.name}</h3>
                <p>
                  {tr('剩余本金')} {formatMoney(selected?.remaining || 0)}
                </p>
                <label className={shared.check}>
                  <input
                    type="checkbox"
                    checked={settle}
                    onChange={e => {
                      setSettle(e.target.checked);
                      if (e.target.checked) setPrincipal(String(selected!.remaining / 100));
                    }}
                  />
                  {tr('提前结清全部本金')}
                </label>
                <div className={shared.grid}>
                  <Field label={tr('本次归还本金')}>
                    {control => (
                      <Input
                        {...control}
                        required
                        className={shared.numeric}
                        inputMode="decimal"
                        value={principal}
                        onChange={e => setPrincipal(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field label={tr('实际利息与手续费')}>
                    {control => (
                      <Input
                        {...control}
                        className={shared.numeric}
                        inputMode="decimal"
                        value={fee}
                        onChange={e => setFee(e.target.value)}
                      />
                    )}
                  </Field>
                  <label>
                    {tr('实际还款日')}
                    <DateField type="date" value={paidDate} onChange={setPaidDate} />
                  </label>
                  <Field label={tr('付款钱包')}>
                    {control => (
                      <Select {...control} required value={payer} onChange={e => setPayer(e.target.value)}>
                        <option value="">{tr('请选择')}</option>
                        {accounts
                          .filter(a => !a.archived && a.usable !== false && a.id !== selected?.account_id)
                          .map(a => (
                            <option
                              key={a.id}
                              value={a.id}
                              data-account={[a.institution, a.name, a.type].filter(Boolean).join(' ')}
                            >
                              {accountLabel(a)}
                            </option>
                          ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={tr('费用分类')}>
                    {control => (
                      <Select {...control} value={category} onChange={e => setCategory(e.target.value)}>
                        {formCategories
                          .filter(c => !c.archived)
                          .map(c => (
                            <option key={c.name} data-icon={c.icon}>
                              {c.name}
                            </option>
                          ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <p className={shared.notice}>
                  {tr('本次实际付款')}{' '}
                  {(() => {
                    try {
                      return formatMoney(cents(principal) + cents(fee));
                    } catch {
                      return '—';
                    }
                  })()}
                </p>
              </>
            )}
            {mode !== 'schedule' && (
              <Field label={tr(mode === 'pay' ? '还款与费用记入账本' : '消费记入账本')}>
                {control => (
                  <Select
                    {...control}
                    disabled={!!seed && mode === 'create'}
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                  >
                    {books
                      .filter(b => b.role !== 'viewer')
                      .map(b => (
                        <option key={b.id} value={b.id} data-icon={b.icon || '📒'}>
                          {b.name}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            )}
            <div className={shared.actions}>
              <Button variant="primary" type="submit" disabled={busy || categoryLoading}>
                {tr(busy ? '正在保存…' : '确认保存')}
              </Button>
              <Button variant="secondary" type="button" onClick={close}>
                {tr('取消')}
              </Button>
            </div>
          </form>
        </Sheet>
      )}
    </Card>
  );
}

export function InstallmentReminder({ revision, onOpen }: { revision: number; onOpen: () => void }) {
  const { t: tr } = useI18n();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    api()
      .then(d => {
        if (active)
          setCount(
            d.plans.filter(
              (p: Plan) => p.remaining > 0 && p.dues.some(r => r.remaining > 0 && r.date <= today()),
            ).length,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [revision]);
  return count > 0 ? (
    <div className={shared.notice}>
      <span>{tr('有 {0} 项分期到期，待核对还款', [count])}</span>
      <Button variant="ghost" onClick={onOpen}>
        {tr('查看分期')}
      </Button>
    </div>
  ) : null;
}
