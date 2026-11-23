'use client';
import { FormSelect } from './FormSelect';
import { Button, Card, Field, Input, ListRow, ConfirmDialog, Sheet } from '@/ui';
import styles from './CostProjects.module.css';
import shared from './WorkspacePlans.module.css';
import { Discussion } from './Discussion';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { calculateCostPlan, type CostPlan } from '@/lib/cost-attribution';
import { PagedList } from './PagedList';
import { CostSchedules } from './CostSchedules';
import { CostSettlementTransfer } from './CostSettlementTransfer';
// CostReport still uses the shared legacy cost layout.
import './cost-projects.css';

async function request(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/cost-projects' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
type Source = { id: string; title: string; payee: string; date: string; amount: number; book_name: string };
type Options = {
  userId: string;
  people: { id: string; name: string; family_id: string; family_name: string }[];
};
function SourcePicker({
  kind,
  onChoose,
  onClose,
}: {
  kind: 'expense' | 'income';
  onChoose: (v: Source) => void;
  onClose: () => void;
}) {
  const { t: tr } = useI18n();
  const [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [rows, setRows] = useState<Source[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(
      () =>
        request('/sources?' + new URLSearchParams({ q, kind, offset: String(offset) }))
          .then(d => {
            if (live) {
              setRows(d);
              setError('');
            }
          })
          .catch(e => {
            if (live) setError(e.message);
          })
          .finally(() => {
            if (live) setLoading(false);
          }),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, kind, offset]);
  return (
    <section className={styles.costSourcePicker} aria-label={tr('选择原始账单')}>
      <div className={shared.toolbar}>
        <h4>{kind === 'income' ? tr('关联工资或其他收入') : tr('关联已支付账单')}</h4>
        <Button variant="ghost" type="button" onClick={onClose}>
          {tr('关闭')}
        </Button>
      </div>
      <label>
        <Search size={16} />
        {tr('跨可编辑账本搜索本人流水')}
        <Input
          autoFocus
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {error && (
        <p role="alert" className={shared.error}>
          {tr(error)}
        </p>
      )}
      {loading ? (
        <p role="status">{tr('正在查找…')}</p>
      ) : (
        rows.slice(0, 20).map(r => (
          <Button
            variant="secondary"
            type="button"
            className={styles.costSourceRow}
            key={r.id}
            onClick={() => onChoose(r)}
          >
            <span>
              <strong>{r.title || r.payee}</strong>
              <small>
                {r.date} · {r.book_name}
              </small>
            </span>
            <b>{formatMoney(r.amount)}</b>
          </Button>
        ))
      )}
      {!loading && !rows.length && <p>{tr('没有符合条件的账单。请先完成真实收付款记账。')}</p>}
      <div className={shared.toolbar}>
        <Button
          variant="secondary"
          type="button"
          disabled={!offset || loading}
          onClick={() => setOffset(v => Math.max(0, v - 20))}
        >
          {tr('上一页')}
        </Button>
        <span>{offset / 20 + 1}</span>
        <Button
          variant="secondary"
          type="button"
          disabled={rows.length <= 20 || loading}
          onClick={() => setOffset(v => v + 20)}
        >
          {tr('下一页')}
        </Button>
      </div>
    </section>
  );
}
function PersonalOffsets({
  entries,
  userId,
  month,
  busy,
  onSave,
}: {
  entries: CostPlan['offsets'];
  userId: string;
  month: string;
  busy: boolean;
  onSave: (entries: CostPlan['offsets']) => void;
}) {
  const { t: tr } = useI18n();
  const [items, setItems] = useState(entries),
    [picker, setPicker] = useState<number | null>(null),
    [editing, setEditing] = useState(false);
  const update = (i: number, patch: Partial<CostPlan['offsets'][number]>) =>
    setItems(old => old.map((o, j) => (i === j ? { ...o, ...patch } : o)));
  return (
    <div className={shared.section}>
      <h3>{tr('我的收入抵减')}</h3>
      <p className={shared.muted}>
        {tr(
          '只改变我的净承担，不改变其他人的分担。可关联工资中的部分金额；默认不共享收入金额和来源。原收入变化后，抵减暂按预计处理，请重新核对保存。',
        )}
      </p>
      {!editing ? (
        <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
          {tr('管理我的抵减')} ({entries.length})
        </Button>
      ) : (
        <>
          <PagedList items={items}>
            {(o, i) => (
              <div className={shared.row}>
                <div className={shared.grid}>
                  <Field label={tr('归属月份')}>
                    {control => (
                      <Input
                        {...control}
                        type="month"
                        value={o.month}
                        onChange={e => update(i, { month: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={tr('抵减金额')}>
                    {control => (
                      <Input
                        {...control}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={o.amount / 100}
                        onChange={e => update(i, { amount: Math.round(Number(e.target.value) * 100) })}
                      />
                    )}
                  </Field>
                </div>
                <div className={shared.toolbar}>
                  <Button variant="secondary" onClick={() => setPicker(i)}>
                    {o.transactionId ? tr('已关联收入 · 更换') : tr('关联到账收入')}
                  </Button>
                  {o.transactionId && (
                    <Button variant="ghost" onClick={() => update(i, { transactionId: null })}>
                      {tr('改为预计')}
                    </Button>
                  )}
                  <label className={shared.check}>
                    <input
                      type="checkbox"
                      checked={o.shared}
                      onChange={e => update(i, { shared: e.target.checked })}
                    />
                    {tr('共享抵减金额（不共享收入来源）')}
                  </label>
                  <Button variant="ghost" onClick={() => setItems(old => old.filter((_, j) => i !== j))}>
                    {tr('移除')}
                  </Button>
                </div>
              </div>
            )}
          </PagedList>
          {picker !== null && (
            <SourcePicker
              kind="income"
              onClose={() => setPicker(null)}
              onChoose={s => {
                update(picker, { transactionId: s.id });
                setPicker(null);
              }}
            />
          )}
          <div className={shared.toolbar}>
            <Button
              variant="secondary"
              onClick={() =>
                setItems(old => [
                  ...old,
                  { id: crypto.randomUUID(), userId, month, transactionId: null, amount: 0, shared: false },
                ])
              }
            >
              {tr('添加抵减')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || items.some(o => !o.amount || !o.month)}
              onClick={() => onSave(items)}
            >
              {tr('保存我的抵减')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setItems(entries);
              }}
            >
              {tr('取消')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function CostProjects({
  month,
  seed,
  onClearSeed,
  initialId,
  onClearTarget,
  scheduleTarget,
  onClearScheduleTarget,
}: {
  scheduleTarget?: { id: string; scope: string };
  onClearScheduleTarget?: () => void;
  initialId?: string;
  onClearTarget?: () => void;
  month: string;
  seed?: { id: string; amount: number; date: string };
  onClearSeed?: () => void;
}) {
  const { t: tr, locale } = useI18n();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [step, setStep] = useState(0);
  const creationId = useRef('');
  const [movements, setMovements] = useState<any[]>([]);
  const [options, setOptions] = useState<Options | null>(null),
    [list, setList] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [plan, setPlan] = useState<CostPlan | null>(null),
    [picker, setPicker] = useState<'expense' | number | null>(null),
    [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [archived, setArchived] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [sourceNames, setSourceNames] = useState<Record<string, string>>({}),
    [movement, setMovement] = useState(''),
    [settlementAmount, setSettlementAmount] = useState('');
  useEffect(() => {
    request('/options')
      .then(setOptions)
      .catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(
      () =>
        request('?' + new URLSearchParams({ q, offset: String(offset), archived: String(archived) }))
          .then(d => {
            if (live) setList(d);
          })
          .catch(e => {
            if (live) setError(e.message);
          })
          .finally(() => {
            if (live) setLoading(false);
          }),
      200,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, offset, archived, revision]);
  const blank = (initial?: typeof seed): CostPlan => {
    creationId.current = crypto.randomUUID();
    return {
      title: '',
      category: tr('其他'),
      familyId: null,
      sources: initial ? [{ transactionId: initial.id, amount: initial.amount }] : [],
      coverageStart: initial?.date || month + '-01',
      coverageEnd: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
        .toISOString()
        .slice(0, 10),
      mode: 'monthly',
      startMonth: month,
      months: 1,
      periods: [],
      shares: [{ userId: options!.userId, amount: initial?.amount || 0 }],
      offsets: [],
    };
  };
  useEffect(() => {
    if (seed && options) {
      setSelected(null);
      setPlan(blank(seed));
      onClearSeed?.();
    }
  }, [seed, options]);
  useEffect(() => {
    if (initialId) {
      void open(initialId);
      onClearTarget?.();
    }
  }, [initialId]);
  useEffect(() => {
    setMovement('');
    setSettlementAmount('');
    setMovements([]);
    if (selected?.id)
      request('/' + selected.id + '/movements')
        .then(setMovements)
        .catch(e => setError(e.message));
  }, [selected?.id]);
  useEffect(() => {
    setStep(0);
  }, [!!plan, selected?.id]);
  const people = options?.people.filter(p => p.family_id === plan?.familyId) || [];
  const person = (id: string) =>
    options?.people.find(p => p.id === id)?.name ||
    selected?.members?.find((m: any) => m.user_id === id)?.name ||
    (id === options?.userId ? tr('我') : id.slice(0, 8));
  const set = (patch: Partial<CostPlan>) => {
    setPlan(p => (p ? { ...p, ...patch } : p));
    setError('');
  };
  let preview: ReturnType<typeof calculateCostPlan> | null = null,
    problem = '';
  if (plan)
    try {
      preview = calculateCostPlan(plan);
    } catch (e) {
      problem = (e as Error).message;
    }
  const total = plan?.sources.reduce((n, s) => n + s.amount, 0) || 0;
  const cents = (value: string) => Math.round(Number(value) * 100);
  async function open(id: string) {
    setBusy(true);
    setError('');
    try {
      const d = await request('/' + id);
      setSelected(d);
      setSourceNames(d.sourceNames || {});
      setPlan(null);
      setNotice('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function operation(path: string, body: any) {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await request('/' + selected.id + path, 'POST', { version: selected.version, ...body });
      await open(selected.id);
      setRevision(v => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!plan || !preview) return;
    setBusy(true);
    setError('');
    try {
      const result = await request(selected ? '/' + selected.id : '', selected ? 'PUT' : 'POST', {
        id: creationId.current,
        plan,
        version: selected?.version,
      });
      await open(result.id || selected.id);
      setRevision(v => v + 1);
      setNotice(tr('费用规则已保存，未新增钱包扣款。'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={shared.panel}>
      <div className={shared.toolbar}>
        <div>
          <h2>{tr('费用归属与分担')}</h2>
          <p className={shared.muted}>{tr('付款只记一次，费用按期、按人查看。个账与公账均可关联。')}</p>
        </div>
        {selected || plan ? (
          <Button
            variant="secondary"
            type="button"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setPlan(null);
              setPicker(null);
              setError('');
              setNotice('');
            }}
          >
            <ArrowLeft size={16} />
            {tr('返回项目')}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!options || busy}
            type="button"
            onClick={() => {
              setPlan(blank());
              setError('');
            }}
          >
            <Plus size={18} />
            {tr('新建费用项目')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className={shared.error}>
          {tr(error)}
        </p>
      )}
      {notice && (
        <p role="status" className={shared.notice}>
          {notice}
        </p>
      )}
      {!selected && !plan && (
        <CostSchedules
          initialTarget={scheduleTarget}
          onClearTarget={onClearScheduleTarget}
          onProject={id => {
            void open(id);
            setRevision(v => v + 1);
          }}
        />
      )}
      {!selected && !plan && (
        <>
          <div className={shared.toolbar}>
            <Field label={tr('搜索费用项目')}>
              {control => (
                <Input
                  {...control}
                  value={q}
                  onChange={e => {
                    setQ(e.target.value);
                    setOffset(0);
                  }}
                />
              )}
            </Field>
            <label className={shared.check}>
              <input
                type="checkbox"
                checked={archived}
                onChange={e => {
                  setArchived(e.target.checked);
                  setOffset(0);
                }}
              />
              {tr('查看已归档')}
            </label>
          </div>
          {loading ? (
            <p role="status">{tr('正在加载…')}</p>
          ) : list.length ? (
            list.map(p => (
              <ListRow
                key={p.id}
                disabled={busy}
                onClick={() => open(p.id)}
                title={p.title}
                end={p.pending ? tr('待成员确认') : tr('已生效')}
              />
            ))
          ) : (
            <p className={shared.empty}>
              {tr('关联一笔已支付账单，设置它属于哪些月份、由谁承担。不会再次扣款。')}
            </p>
          )}
          <div className={shared.toolbar}>
            <Button variant="secondary" disabled={!offset || loading} onClick={() => setOffset(v => v - 20)}>
              {tr('上一页')}
            </Button>
            <span>
              {offset / 20 + 1} / {Math.max(1, Math.ceil((list[0]?.total || 0) / 20))}
            </span>
            <Button
              variant="secondary"
              disabled={loading || offset + 20 >= (list[0]?.total || 0)}
              onClick={() => setOffset(v => v + 20)}
            >
              {tr('下一页')}
            </Button>
          </div>
        </>
      )}
      {plan && (
        <Sheet
          open
          wide
          title={selected ? tr('编辑费用项目') : tr('新建费用项目')}
          closeLabel={tr('关闭弹窗')}
          onClose={() => {
            if (!busy) {
              setPlan(null);
              setPicker(null);
            }
          }}
        >
          <form
            noValidate
            onSubmit={e => {
              e.preventDefault();
              if (step < 2) {
                const invalid = Array.from(
                  e.currentTarget.querySelectorAll<HTMLInputElement>('input,select,textarea'),
                ).find(input => input.getClientRects().length && !input.checkValidity());
                if (invalid) {
                  invalid.reportValidity();
                  return;
                }
                setStep(step + 1);
              } else if (preview) void save();
            }}
          >
            <fieldset disabled={busy}>
              <ol className={styles.costSteps} aria-label={tr('设置进度')}>
                {[tr('原始账单'), tr('期间与成员'), tr('核对确认')].map((label, i) => (
                  <li key={i} aria-current={step === i ? 'step' : undefined}>
                    <Button
                      variant="primary"
                      type="button"
                      disabled={i > step}
                      onClick={() => {
                        setStep(i);
                      }}
                    >
                      {i + 1}. {label}
                    </Button>
                  </li>
                ))}
              </ol>
              <div hidden={step !== 0}>
                <div className={shared.section}>
                  <h3>{tr('原始付款')}</h3>
                  <div className={shared.grid}>
                    <Field label={tr('费用名称')}>
                      {control => (
                        <Input
                          {...control}
                          required
                          maxLength={120}
                          value={plan.title}
                          onChange={e => set({ title: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={tr('费用分类')}>
                      {control => (
                        <Input
                          {...control}
                          required
                          maxLength={60}
                          value={plan.category}
                          onChange={e => set({ category: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                  <PagedList items={plan.sources}>
                    {(s, i) => (
                      <div className={shared.row}>
                        <span>
                          {sourceNames[s.transactionId] || tr('已关联付款')}
                          <small>{s.transactionId.slice(0, 8)}</small>
                        </span>
                        <Field label={tr('参与分摊金额')}>
                          {control => (
                            <Input
                              {...control}
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={s.amount / 100}
                              onChange={e =>
                                set({
                                  sources: plan.sources.map((v, j) =>
                                    j === i ? { ...v, amount: cents(e.target.value) } : v,
                                  ),
                                })
                              }
                            />
                          )}
                        </Field>
                        <Button
                          variant="ghost"
                          type="button"
                          aria-label={tr('移除付款关联')}
                          onClick={() => set({ sources: plan.sources.filter((_, j) => j !== i) })}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    )}
                  </PagedList>
                  <Button variant="secondary" type="button" onClick={() => setPicker('expense')}>
                    <Plus size={16} />
                    {tr('查找已支付账单')}
                  </Button>
                  <p>
                    {tr('本项目原始费用')} <strong>{formatMoney(total)}</strong>
                  </p>
                </div>
              </div>
              <div hidden={step !== 1}>
                <div className={shared.section}>
                  <h3>{tr('期间归属')}</h3>
                  <div className={shared.grid}>
                    <Field label={tr('实际覆盖开始日')}>
                      {control => (
                        <Input
                          {...control}
                          type="date"
                          required
                          value={plan.coverageStart}
                          onChange={e => set({ coverageStart: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={tr('覆盖结束日（不含当天）')}>
                      {control => (
                        <Input
                          {...control}
                          type="date"
                          required
                          value={plan.coverageEnd}
                          onChange={e => set({ coverageEnd: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label={tr('分摊方式')}>
                      {() => (
                        <FormSelect
                          aria-label={tr('分摊方式')}
                          value={plan.mode}
                          onChange={next => set({ mode: next as CostPlan['mode'] })}
                        >
                          <option value="monthly">{tr('指定自然月等额')}</option>
                          <option value="daily">{tr('真实覆盖期按天')}</option>
                          <option value="custom">{tr('自定义期间金额')}</option>
                        </FormSelect>
                      )}
                    </Field>
                    {plan.mode === 'monthly' && (
                      <>
                        <Field label={tr('归属起始月份')}>
                          {control => (
                            <Input
                              {...control}
                              type="month"
                              required
                              value={plan.startMonth}
                              onChange={e => set({ startMonth: e.target.value })}
                            />
                          )}
                        </Field>
                        <Field label={tr('分摊月数')}>
                          {control => (
                            <Input
                              {...control}
                              type="number"
                              min={1}
                              max={1200}
                              required
                              value={plan.months}
                              onChange={e => set({ months: Number(e.target.value) })}
                            />
                          )}
                        </Field>
                      </>
                    )}
                  </div>
                  {plan.mode === 'custom' && (
                    <>
                      <PagedList items={plan.periods}>
                        {(p, i) => (
                          <div className={shared.row}>
                            <Field label={tr('开始')}>
                              {control => (
                                <Input
                                  {...control}
                                  type="date"
                                  required
                                  value={p.start}
                                  onChange={e =>
                                    set({
                                      periods: plan.periods.map((v, j) =>
                                        j === i ? { ...v, start: e.target.value } : v,
                                      ),
                                    })
                                  }
                                />
                              )}
                            </Field>
                            <Field label={tr('结束（不含当天）')}>
                              {control => (
                                <Input
                                  {...control}
                                  type="date"
                                  required
                                  value={p.end}
                                  onChange={e =>
                                    set({
                                      periods: plan.periods.map((v, j) =>
                                        j === i ? { ...v, end: e.target.value } : v,
                                      ),
                                    })
                                  }
                                />
                              )}
                            </Field>
                            <Field label={tr('金额')}>
                              {control => (
                                <Input
                                  {...control}
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={p.amount / 100}
                                  onChange={e =>
                                    set({
                                      periods: plan.periods.map((v, j) =>
                                        j === i ? { ...v, amount: cents(e.target.value) } : v,
                                      ),
                                    })
                                  }
                                />
                              )}
                            </Field>
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => set({ periods: plan.periods.filter((_, j) => j !== i) })}
                            >
                              {tr('移除')}
                            </Button>
                          </div>
                        )}
                      </PagedList>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() =>
                          set({
                            periods: [
                              ...plan.periods,
                              { start: plan.coverageStart, end: plan.coverageEnd, amount: total },
                            ],
                          })
                        }
                      >
                        {tr('添加期间')}
                      </Button>
                    </>
                  )}
                </div>
                <div className={shared.section}>
                  <h3>{tr('成员承担')}</h3>
                  <Field label={tr('选人范围（不改变记入账本）')}>
                    {() => (
                      <FormSelect
                        aria-label={tr('选人范围（不改变记入账本）')}
                        disabled={!!selected}
                        value={plan.familyId || ''}
                        onChange={next =>
                          set({
                            familyId: next || null,
                            shares: [{ userId: options!.userId, amount: total }],
                          })
                        }
                      >
                        <option value="">{tr('仅自己')}</option>
                        {[...new Map(options?.people.map(p => [p.family_id, p.family_name])).entries()].map(
                          ([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ),
                        )}
                      </FormSelect>
                    )}
                  </Field>
                  {!selected &&
                    people
                      .filter(p => p.id !== options?.userId)
                      .map(p => (
                        <label className={shared.check} key={p.id}>
                          <input
                            type="checkbox"
                            checked={plan.shares.some(s => s.userId === p.id)}
                            onChange={e =>
                              set({
                                shares: e.target.checked
                                  ? [...plan.shares, { userId: p.id, amount: 0 }]
                                  : plan.shares.filter(s => s.userId !== p.id),
                              })
                            }
                          />
                          {p.name}
                        </label>
                      ))}
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() =>
                      set({
                        shares: plan.shares.map((s, i) => ({
                          ...s,
                          amount:
                            Math.floor(total / plan.shares.length) + (i < total % plan.shares.length ? 1 : 0),
                        })),
                      })
                    }
                  >
                    {tr('按当前成员均分')}
                  </Button>
                  <div className={shared.grid}>
                    {plan.shares.map((s, i) => (
                      <label key={s.userId}>
                        {person(s.userId)} · {tr('全期承担')}
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          required
                          value={s.amount / 100}
                          onChange={e =>
                            set({
                              shares: plan.shares.map((v, j) =>
                                j === i ? { ...v, amount: cents(e.target.value) } : v,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className={shared.muted}>
                    {tr('其他成员须确认分担。私人账单详情和钱包余额不随邀请共享。')}
                  </p>
                </div>
                <div className={shared.section}>
                  <h3>{tr('收入抵减（可选）')}</h3>
                  <p className={shared.muted}>
                    {tr('工资等任意收入可关联部分金额。预计收入不计入已实现净承担。')}
                  </p>
                  <PagedList items={plan.offsets}>
                    {(o, i) => (
                      <div className={shared.row}>
                        <div className={shared.grid}>
                          <Field label={tr('归属月份')}>
                            {control => (
                              <Input
                                {...control}
                                type="month"
                                required
                                value={o.month}
                                onChange={e =>
                                  set({
                                    offsets: plan.offsets.map((v, j) =>
                                      j === i ? { ...v, month: e.target.value } : v,
                                    ),
                                  })
                                }
                              />
                            )}
                          </Field>
                          <Field label={tr('抵减金额')}>
                            {control => (
                              <Input
                                {...control}
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                value={o.amount / 100}
                                onChange={e =>
                                  set({
                                    offsets: plan.offsets.map((v, j) =>
                                      j === i ? { ...v, amount: cents(e.target.value) } : v,
                                    ),
                                  })
                                }
                              />
                            )}
                          </Field>
                          <Field label={tr('受益人')}>
                            {() => (
                              <FormSelect
                                aria-label={tr('受益人')}
                                value={o.userId}
                                onChange={next =>
                                  set({
                                    offsets: plan.offsets.map((v, j) =>
                                      j === i
                                        ? {
                                            ...v,
                                            userId: next,
                                            shared: next !== options?.userId || v.shared,
                                          }
                                        : v,
                                    ),
                                  })
                                }
                              >
                                {plan.shares.map(s => (
                                  <option key={s.userId} value={s.userId}>
                                    {person(s.userId)}
                                  </option>
                                ))}
                              </FormSelect>
                            )}
                          </Field>
                        </div>
                        <div className={shared.toolbar}>
                          <Button variant="secondary" type="button" onClick={() => setPicker(i)}>
                            {o.transactionId ? tr('已关联到账收入 · 更换') : tr('关联实际到账收入')}
                          </Button>
                          {o.transactionId && (
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() =>
                                set({
                                  offsets: plan.offsets.map((v, j) =>
                                    j === i ? { ...v, transactionId: null } : v,
                                  ),
                                })
                              }
                            >
                              {tr('改为预计')}
                            </Button>
                          )}
                          <label className={shared.check}>
                            <input
                              type="checkbox"
                              checked={o.shared}
                              onChange={e =>
                                set({
                                  offsets: plan.offsets.map((v, j) =>
                                    j === i ? { ...v, shared: e.target.checked } : v,
                                  ),
                                })
                              }
                            />
                            {tr('向参与者共享抵减金额')}
                          </label>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => set({ offsets: plan.offsets.filter((_, j) => j !== i) })}
                          >
                            {tr('移除')}
                          </Button>
                        </div>
                        <small>
                          {o.transactionId
                            ? sourceNames[o.transactionId] || tr('实际收入关联')
                            : tr('预计，尚未计入实际抵减')}
                        </small>
                      </div>
                    )}
                  </PagedList>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      set({
                        offsets: [
                          ...plan.offsets,
                          {
                            id: crypto.randomUUID(),
                            transactionId: null,
                            userId: options!.userId,
                            month: plan.startMonth,
                            amount: 0,
                            shared: false,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={16} />
                    {tr('添加抵减')}
                  </Button>
                </div>
              </div>
              {picker !== null && (
                <SourcePicker
                  kind={picker === 'expense' ? 'expense' : 'income'}
                  onClose={() => setPicker(null)}
                  onChoose={s => {
                    setSourceNames(n => ({ ...n, [s.id]: s.title || s.payee }));
                    if (picker === 'expense') {
                      set({
                        title: plan.title || s.title || s.payee,
                        sources: [...plan.sources, { transactionId: s.id, amount: s.amount }],
                        ...(plan.shares.length === 1
                          ? { shares: [{ ...plan.shares[0], amount: total + s.amount }] }
                          : {}),
                      });
                    } else {
                      set({
                        offsets: plan.offsets.map((o, i) =>
                          i === picker ? { ...o, transactionId: s.id } : o,
                        ),
                      });
                    }
                    setPicker(null);
                  }}
                />
              )}
              {step === 2 && (
                <div className={shared.section}>
                  <p>
                    <strong>{plan.title}</strong> · {plan.coverageStart} → {plan.coverageEnd}
                  </p>
                  <h3>{tr('确认预览')}</h3>
                  {problem ? (
                    <p role="alert" className={shared.error}>
                      {tr(problem)}
                    </p>
                  ) : (
                    preview && (
                      <>
                        <p className={shared.notice}>{tr('本次仅更新费用分析，不新增收入或扣款。')}</p>
                        <PagedList items={preview.periods}>
                          {p => (
                            <div className={shared.row}>
                              <strong>
                                {p.start} → {p.end}
                              </strong>
                              <b>{formatMoney(p.amount)}</b>
                              <div>
                                {p.shares.map(s => (
                                  <span key={s.userId}>
                                    {person(s.userId)} {formatMoney(s.amount)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </PagedList>
                      </>
                    )
                  )}
                </div>
              )}
              <div className={shared.toolbar}>
                {step > 0 && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setStep(step - 1);
                    }}
                  >
                    {tr('上一步')}
                  </Button>
                )}
                <Button variant="primary" type="submit" disabled={busy || (step === 2 && !preview)}>
                  {busy ? tr('正在保存…') : step === 2 ? tr('确认保存规则') : tr('下一步')}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setPlan(null);
                    setPicker(null);
                  }}
                >
                  {tr('取消编辑')}
                </Button>
              </div>
            </fieldset>
          </form>
        </Sheet>
      )}
      {selected && !plan && (
        <>
          <div className={shared.toolbar}>
            <div>
              <h3>{selected.title}</h3>
              <p>
                {selected.coverageStart} → {selected.coverageEnd} · {tr('原始费用')}{' '}
                {formatMoney(selected.total)}
              </p>
            </div>
            {confirmArchive && (
              <ConfirmDialog
                open
                title={selected.archived ? tr('恢复项目') : tr('归档项目')}
                onCancel={() => setConfirmArchive(false)}
                onConfirm={() => {
                  setConfirmArchive(false);
                  void operation('/archive', { archived: !selected.archived });
                }}
              >
                {selected.title}
              </ConfirmDialog>
            )}
            {selected.ownerId === options?.userId && (
              <>
                <Button
                  variant="secondary"
                  disabled={busy || selected.archived}
                  onClick={() => {
                    setPlan(selected.proposedPlan || selected.plan);
                  }}
                >
                  {tr('编辑规则')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setConfirmArchive(true)}>
                  {selected.archived ? tr('恢复项目') : tr('归档项目')}
                </Button>
              </>
            )}
          </div>
          {!selected.valid && (
            <p role="alert" className={shared.error}>
              {tr('来源已变化，请所有者核对后重新保存。以下是原规则，不作为当前有效统计。')}
            </p>
          )}
          {selected.pending && !selected.archived && (
            <div className={shared.notice}>
              <p>{tr('存在待确认的分担规则；已生效版本在确认完成前保持不变。')}</p>
              <PagedList items={selected.proposedPeriods || []}>
                {(p: any) => (
                  <p>
                    {p.start} ·{' '}
                    {p.shares.map((s: any) => `${person(s.userId)} ${formatMoney(s.amount)}`).join(' / ')}
                  </p>
                )}
              </PagedList>
              <PagedList items={selected.proposedOffsets || []}>
                {(o: any) => (
                  <p>
                    {o.month} · {person(o.userId)} · {o.realized ? tr('到账抵减') : tr('预计抵减')}{' '}
                    {formatMoney(o.amount)}
                  </p>
                )}
              </PagedList>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => operation('/respond', { accept: true })}
              >
                {tr('接受本版分担')}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => operation('/respond', { accept: false })}
              >
                {tr('拒绝本版分担')}
              </Button>
            </div>
          )}
          <div className={shared.section}>
            <h3>{tr('我的月度承担')}</h3>
            <p className={shared.muted}>{tr('分摊记录不扣钱包；未到账抵减单独显示。')}</p>
            <PagedList items={selected.personal}>
              {(r: any) => (
                <div className={shared.row}>
                  <strong>{r.month}</strong>
                  <dl>
                    <div>
                      <dt>{tr('承担')}</dt>
                      <dd>{formatMoney(r.cost)}</dd>
                    </div>
                    <div>
                      <dt>{tr('到账抵减')}</dt>
                      <dd>{formatMoney(r.offset)}</dd>
                    </div>
                    <div>
                      <dt>{tr('净承担')}</dt>
                      <dd>
                        <strong>{formatMoney(r.net)}</strong>
                      </dd>
                    </div>
                    {r.expected > 0 && (
                      <div>
                        <dt>{tr('预计净承担')}</dt>
                        <dd>{formatMoney(r.projected)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </PagedList>
          </div>
          {options && !selected.archived && (
            <PersonalOffsets
              key={selected.id + ':' + selected.version}
              entries={selected.personalOffsets || []}
              userId={options.userId}
              month={selected.coverageStart.slice(0, 7)}
              busy={busy}
              onSave={entries => operation('/personal-offsets', { entries })}
            />
          )}
          {options && (
            <CostSettlementTransfer
              key={selected.id}
              project={selected}
              userId={options.userId}
              onChanged={() => open(selected.id)}
            />
          )}
          <div className={shared.section}>
            <h3>{tr('全项目结算')}</h3>
            {selected.settlement.map((s: any) => (
              <p key={s.userId}>
                {person(s.userId)} · {s.balance >= 0 ? tr('待收回') : tr('待补付')}{' '}
                <strong>{formatMoney(Math.abs(s.balance))}</strong>
              </p>
            ))}
            <p className={shared.muted}>{tr('只关联参与人之间已经确认的真实转账，不再次扣款。')}</p>
            <div className={shared.grid}>
              <Field label={tr('已确认的家庭转账')}>
                {() => (
                  <FormSelect
                    aria-label={tr('已确认的家庭转账')}
                    value={movement}
                    onChange={next => {
                      setMovement(next);
                      const m = movements.find(m => m.id === next);
                      setSettlementAmount(m ? String(m.amount / 100) : '');
                    }}
                  >
                    <option value="">{tr('选择已有转账')}</option>
                    {movements.map(m => (
                      <option key={m.id} value={m.id}>
                        {String(m.date).slice(0, 10)} · {m.sender} → {m.recipient} · {formatMoney(m.amount)}
                      </option>
                    ))}
                  </FormSelect>
                )}
              </Field>
              <Field label={tr('用于本项目的金额')}>
                {control => (
                  <Input
                    {...control}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={settlementAmount}
                    onChange={e => setSettlementAmount(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Button
              variant="secondary"
              disabled={busy || !selected.active || !selected.valid || !movement || !Number(settlementAmount)}
              onClick={() =>
                operation('/settlements', { movementId: movement, amount: cents(settlementAmount) })
              }
            >
              {tr('关联已有结算')}
            </Button>
          </div>
          <div className={shared.section}>
            <h3>{tr('变更记录')}</h3>
            <PagedList items={selected.changes}>
              {(c: any) => (
                <p>
                  {(
                    {
                      settlement_sent: tr('记录成员转款'),
                      settlement_confirmed: tr('确认到账'),
                      settlement_cancelled: tr('取消转款'),
                      personal_offsets: tr('个人抵减更新'),
                      created: tr('创建'),
                      accepted: tr('接受'),
                      rejected: tr('拒绝'),
                      revised: tr('修订'),
                      settlement: tr('关联结算'),
                      archive: tr('归档状态变更'),
                    } as Record<string, string>
                  )[c.operation] || c.operation}{' '}
                  · v{c.version} · {new Date(c.created_at).toLocaleString(locale)}
                </p>
              )}
            </PagedList>
          </div>
          <Discussion key={selected.id} target={{ kind: 'project', id: selected.id }} />
        </>
      )}
    </Card>
  );
}
