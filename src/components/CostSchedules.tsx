'use client';
import { FormSelect } from './FormSelect';
import { Button, Field, Input, TextArea, Money, ListRow, Sheet } from '@/ui';
import styles from './CostSchedules.module.css';
import shared from './WorkspacePlans.module.css';
import { Discussion } from './Discussion';
import { useEffect, useState } from 'react';
import { useI18n } from './LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { costScheduleProgress, type CostSchedule } from '@/lib/cost-schedule';
import { PagedList } from './PagedList';

// Operate: extend the existing cost surface, separating promises from money paid.
// Inherit its type, colors and responsive form grid. No extra modal or new theme.
// First viewport: next due date and status; actions reveal one inline task at a time.
// Finish: inspect desktop/mobile and hand off review and surface documentation.
async function api(path: string, body?: unknown) {
  const r = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
export function CostSchedules({
  onProject,
  initialTarget,
  onClearTarget,
}: {
  initialTarget?: { id: string; scope: string };
  onClearTarget?: () => void;
  onProject: (id: string) => void;
}) {
  const { t: tr } = useI18n();
  const [rows, setRows] = useState<any[]>([]),
    [options, setOptions] = useState<any>(null),
    [books, setBooks] = useState<any[]>([]),
    [assets, setAssets] = useState<any[]>([]);
  const [rule, setRule] = useState<CostSchedule | null>(null),
    [creationId, setCreationId] = useState(''),
    [book, setBook] = useState(''),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<any>(null),
    [action, setAction] = useState(''),
    [history, setHistory] = useState<any[]>([]),
    [historyOffset, setHistoryOffset] = useState(0),
    [historyLoading, setHistoryLoading] = useState(false),
    [sourceLoading, setSourceLoading] = useState(false);
  const [account, setAccount] = useState(''),
    [paidDate, setPaidDate] = useState(''),
    [paymentMode, setPaymentMode] = useState('new'),
    [sources, setSources] = useState<any[]>([]),
    [source, setSource] = useState(''),
    [query, setQuery] = useState(''),
    [sourceOffset, setSourceOffset] = useState(0);
  const [discussionScope, setDiscussionScope] = useState('');
  const [receiptReply, setReceiptReply] = useState('');
  const [receiptMovement, setReceiptMovement] = useState(''),
    [receiptWallet, setReceiptWallet] = useState('');
  useEffect(() => {
    Promise.all([api('cost-projects/options'), api('books'), api('assets')])
      .then(([o, b, a]) => {
        setOptions(o);
        setBooks(b.filter((v: any) => v.role !== 'viewer'));
        setAssets(a.filter((v: any) => v.owner_id === o.userId && !v.archived));
      })
      .catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    api('cost-schedules?offset=' + offset)
      .then(v => {
        if (live) setRows(v);
      })
      .catch(e => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [offset, revision]);
  useEffect(() => {
    if (action !== 'history' || !selected) return;
    let live = true;
    setHistoryLoading(true);
    api(`cost-schedules/${selected.id}/history?offset=${historyOffset}`)
      .then(v => {
        if (live) setHistory(v);
      })
      .catch(e => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setHistoryLoading(false);
      });
    return () => {
      live = false;
    };
  }, [action, selected, historyOffset]);
  useEffect(() => {
    if (action !== 'pay' || paymentMode !== 'existing') return;
    let live = true;
    setSourceLoading(true);
    const timer = setTimeout(
      () =>
        api('cost-projects/sources?' + new URLSearchParams({ q: query, offset: String(sourceOffset) }))
          .then(v => {
            if (live) setSources(v);
          })
          .catch(e => {
            if (live) setError(e.message);
          })
          .finally(() => {
            if (live) setSourceLoading(false);
          }),
      250,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [action, paymentMode, query, sourceOffset]);
  useEffect(() => {
    if (!initialTarget) return;
    let live = true;
    api('cost-schedules/' + initialTarget.id)
      .then(s => {
        if (live) {
          open(s, 'discussion');
          setDiscussionScope(initialTarget.scope);
          onClearTarget?.();
        }
      })
      .catch(e => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [initialTarget]);
  const people = options?.people.filter((p: any) => p.family_id === rule?.familyId) || [];
  const name = (id: string) => options?.people.find((p: any) => p.id === id)?.name || tr('我');
  const update = (patch: Partial<CostSchedule>) => setRule(v => (v ? { ...v, ...patch } : v));
  const close = () => {
    setSelected(null);
    setAction('');
    setRule(null);
  };
  async function run(path: string, body: any) {
    setBusy(true);
    setError('');
    try {
      const result = await api('cost-schedules' + path, body);
      close();
      setRevision(v => v + 1);
      if (result.project_id || path.endsWith('/receive'))
        window.dispatchEvent(new Event('cost-payment-recorded'));
      if (result.project_id) onProject(result.project_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(s: any, kind: string) {
    setReceiptReply('');
    setDiscussionScope('');
    setSelected(s);
    setAction(kind);
    setRule(null);
    setBook(s.members.find((m: any) => m.user_id === options?.userId)?.book_id || '');
    setAccount('');
    setSource('');
    setSources([]);
    setQuery('');
    setSourceOffset(0);
    setHistoryOffset(0);
    setHistory([]);
    setPaymentMode('new');
    setPaidDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }));
    setReceiptMovement(s.receiptMovements?.[0]?.id || '');
    setReceiptWallet('');
    setError('');
  }
  const selectedMovement = selected?.receiptMovements?.find((m: any) => m.id === receiptMovement),
    selectedShare = selected?.rule.shares.find((p: any) => p.userId === selectedMovement?.sender_id),
    selectedReceived = Number(
      selected?.received?.find((p: any) => p.user_id === selectedMovement?.sender_id)?.amount || 0,
    ),
    selectedExpected = selectedShare ? selectedShare.amount * selected.rule.months : 0,
    selectedRemaining = Math.max(0, selectedExpected - selectedReceived);
  const bookField = (
    <Field label={action === 'pay' ? tr('付款记入账本') : tr('我的归属账本')}>
      {() => (
        <FormSelect
          aria-label={action === 'pay' ? tr('付款记入账本') : tr('我的归属账本')}
          required
          value={book}
          onChange={next => setBook(next)}
        >
          <option value="">{tr('选择账本')}</option>
          {books.map(b => (
            <option key={b.id} value={b.id} data-icon={b.icon}>
              {b.name}
            </option>
          ))}
        </FormSelect>
      )}
    </Field>
  );
  return (
    <div className={shared.section}>
      <div className={shared.toolbar}>
        <div>
          <h3>{tr('周期费用计划')}</h3>
          <p className={shared.muted}>
            {tr('先定规则，由付款人确认实付。成员分摊可提前到账并关联本期，不会重复结算。')}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!options || busy}
          onClick={() => {
            close();
            setCreationId(crypto.randomUUID());
            setBook('');
            setRule({
              title: '',
              category: tr('房租'),
              familyId: null,
              firstDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
              months: 3,
              shares: [{ userId: options.userId, amount: 0 }],
            });
          }}
        >
          {tr('新建周期计划')}
        </Button>
      </div>
      {error && (
        <p className={shared.error} role="alert">
          {tr(error)}
        </p>
      )}
      {rule ? (
        <Sheet
          open
          wide
          title={action === 'edit' ? tr('编辑周期计划') : tr('新建周期计划')}
          closeLabel={tr('关闭弹窗')}
          onClose={() => {
            if (!busy) close();
          }}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              void run(action === 'edit' ? '/' + selected.id + '/edit' : '', {
                id: creationId,
                rule,
                bookId: book,
                ...(action === 'edit' ? { version: selected.version } : {}),
              });
            }}
          >
            <fieldset disabled={busy}>
              <h4>{action === 'edit' ? tr('编辑周期计划') : tr('周期和金额')}</h4>
              {action === 'edit' && (
                <p className={shared.notice}>
                  {tr(
                    '仅修改后续计划，历史付款与分摊保持不变。修改成员、承担金额或延长计划后，其他成员需要重新确认。',
                  )}
                </p>
              )}
              <div className={shared.grid}>
                <Field label={tr('名称')}>
                  {control => (
                    <Input
                      {...control}
                      required
                      maxLength={120}
                      value={rule.title}
                      onChange={e => update({ title: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={tr('分类')}>
                  {control => (
                    <Input
                      {...control}
                      required
                      value={rule.category}
                      onChange={e => update({ category: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={tr('首次付款日')}>
                  {control => (
                    <Input
                      {...control}
                      disabled={action === 'edit' && selected?.processed > 0}
                      required
                      type="date"
                      value={rule.firstDate}
                      onChange={e => update({ firstDate: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={tr('每隔几个月付款')}>
                  {control => (
                    <Input
                      {...control}
                      disabled={action === 'edit' && selected?.processed > 0}
                      required
                      type="number"
                      min={1}
                      max={120}
                      value={rule.months}
                      onChange={e => update({ months: Number(e.target.value) })}
                    />
                  )}
                </Field>
                <Field label={tr('结束规则')}>
                  {() => (
                    <FormSelect
                      aria-label={tr('结束规则')}
                      value={rule.totalCycles == null ? 'unlimited' : 'limited'}
                      onChange={next =>
                        update({
                          totalCycles: next === 'unlimited' ? null : Math.max(1, selected?.processed || 0),
                        })
                      }
                    >
                      <option value="unlimited">{tr('持续重复')}</option>
                      <option value="limited">{tr('指定总期数')}</option>
                    </FormSelect>
                  )}
                </Field>
                {rule.totalCycles != null && (
                  <Field label={tr('总期数（含已处理）')}>
                    {control => (
                      <Input
                        {...control}
                        required
                        type="number"
                        min={Math.max(1, selected?.processed || 0)}
                        max={120}
                        value={rule.totalCycles ?? ''}
                        onChange={e => update({ totalCycles: Number(e.target.value) })}
                      />
                    )}
                  </Field>
                )}
                {bookField}
                <Field label={tr('参与家庭')}>
                  {() => (
                    <FormSelect
                      aria-label={tr('参与家庭')}
                      value={rule.familyId || ''}
                      onChange={next =>
                        update({
                          familyId: next || null,
                          shares: [rule.shares.find(s => s.userId === options.userId)!],
                        })
                      }
                    >
                      <option value="">{tr('仅自己')}</option>
                      {[
                        ...new Map<string, string>(
                          options.people.map((p: any) => [p.family_id, p.family_name]),
                        ).entries(),
                      ].map(([id, n]) => (
                        <option key={id} value={id}>
                          {n}
                        </option>
                      ))}
                    </FormSelect>
                  )}
                </Field>
              </div>
              <h4>{tr('每人每月承担')}</h4>
              {people
                .filter((p: any) => p.id !== options.userId)
                .map((p: any) => (
                  <label className={shared.check} key={p.id}>
                    <input
                      type="checkbox"
                      checked={rule.shares.some(s => s.userId === p.id)}
                      onChange={e =>
                        update({
                          shares: e.target.checked
                            ? [...rule.shares, { userId: p.id, amount: 0 }]
                            : rule.shares.filter(s => s.userId !== p.id),
                        })
                      }
                    />
                    {p.name}
                  </label>
                ))}
              <div className={shared.grid}>
                {rule.shares.map((s, i) => (
                  <Field key={s.userId} label={name(s.userId)}>
                    {control => (
                      <Input
                        {...control}
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={s.amount / 100}
                        onChange={e =>
                          update({
                            shares: rule.shares.map((v, j) =>
                              j === i ? { ...v, amount: Math.round(Number(e.target.value) * 100) } : v,
                            ),
                          })
                        }
                      />
                    )}
                  </Field>
                ))}
              </div>
              {rule.totalCycles != null && rule.firstDate && rule.months > 0 && (
                <p className={shared.notice}>
                  {tr('覆盖结束日（不含当天）：')}
                  {costScheduleProgress(rule, 0).coverageEnd} · {tr('跳过的账期也计入总期数。')}
                </p>
              )}
              <p>
                {tr('每期付款')}{' '}
                <strong>{formatMoney(rule.shares.reduce((n, s) => n + s.amount, 0) * rule.months)}</strong>
              </p>
              <p className={shared.muted}>
                {tr(
                  '成本从付款日所在自然月起等额归属。其他成员需接受规则并选择自己的账本。现在不需要选择钱包，不会入账。',
                )}
              </p>
              <div className={shared.toolbar}>
                <Button variant="primary" type="submit">
                  {busy ? tr('保存中…') : action === 'edit' ? tr('保存计划修改') : tr('保存计划，不扣款')}
                </Button>
                <Button variant="ghost" type="button" onClick={close}>
                  {tr('取消')}
                </Button>
              </div>
            </fieldset>
          </form>
        </Sheet>
      ) : selected ? (
        <div>
          <div className={shared.toolbar}>
            <h4>
              {selected.rule.title} · {selected.next_date}
            </h4>
            <Button variant="ghost" disabled={busy} onClick={close}>
              {tr('返回计划')}
            </Button>
          </div>
          {action === 'receive' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                void run('/' + selected.id + '/receive', {
                  version: selected.version,
                  dueDate: selected.next_date,
                  movementId: receiptMovement,
                  ...(selectedMovement?.status === 'pending'
                    ? { targetId: receiptWallet, reply: receiptReply }
                    : {}),
                });
              }}
            >
              <p>
                {tr('本期该成员分摊应付')} <strong>{formatMoney(selectedExpected)}</strong> ·{' '}
                {tr('已确认到账')}: {formatMoney(selectedReceived)} · {tr('待收')}:{' '}
                {formatMoney(selectedRemaining)}
              </p>
              <p className={shared.notice}>
                {tr(
                  '选择对方已转给你的本期分摊。待确认转款会记入你选择的个人钱包；已确认到账的转款只关联本期，不会重复入账。',
                )}
              </p>
              {selected.receiptMovements?.length ? (
                <>
                  <Field label={tr('转款记录')}>
                    {() => (
                      <FormSelect
                        aria-label={tr('转款记录')}
                        required
                        value={receiptMovement}
                        onChange={next => {
                          setReceiptMovement(next);
                          setReceiptWallet('');
                        }}
                      >
                        {selected.receiptMovements.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.sender_name} · {formatMoney(m.amount)} · {m.date} ·{' '}
                            {m.status === 'pending' ? tr('待确认到账') : tr('已到账')}
                          </option>
                        ))}
                      </FormSelect>
                    )}
                  </Field>
                  {selectedMovement?.status === 'pending' && (
                    <>
                      <Field label={tr('回复转账人（选填，对方可见）')}>
                        {control => (
                          <TextArea
                            {...control}
                            maxLength={2000}
                            value={receiptReply}
                            onChange={e => setReceiptReply(e.target.value)}
                          />
                        )}
                      </Field>
                      <Field label={tr('我的到账钱包')}>
                        {() => (
                          <FormSelect
                            aria-label={tr('我的到账钱包')}
                            required
                            value={receiptWallet}
                            onChange={next => setReceiptWallet(next)}
                          >
                            <option value="">{tr('选择实际到账钱包')}</option>
                            {assets.map(a => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </FormSelect>
                        )}
                      </Field>
                      <p className={shared.muted}>
                        {tr('确认后钱包余额增加')} {formatMoney(selectedMovement.amount)}。
                      </p>
                    </>
                  )}
                </>
              ) : (
                <p className={shared.muted}>
                  {tr('没有可关联的成员转款。请确认对方已在家庭往来中记录转款，或先完成待收款确认。')}
                </p>
              )}
              <div className={shared.toolbar}>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={
                    busy || !selectedMovement || (selectedMovement.status === 'pending' && !receiptWallet)
                  }
                >
                  {tr('确认本期分摊到账')}
                </Button>
              </div>
            </form>
          )}
          {action === 'respond' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                void run('/' + selected.id + '/respond', {
                  version: selected.version,
                  accept: true,
                  bookId: book,
                });
              }}
            >
              <p>{tr('接受以下规则，后续付款确认后自动归属到你选择的账本，不产生额外扣款。')}</p>
              <p>
                <strong>
                  {tr('每')} {selected.rule.months} {tr('个月付款，每期')}{' '}
                  {formatMoney(
                    selected.rule.shares.reduce((n: number, s: any) => n + s.amount, 0) *
                      selected.rule.months,
                  )}
                </strong>
              </p>
              <p className={shared.muted}>
                {tr('分类：')}
                {selected.rule.category} · {tr('成本从到期日所在自然月起，按上述周期的月数等额分摊。')}
              </p>
              <p className={shared.notice}>
                {selected.totalCycles
                  ? `${tr('总期数')}: ${selected.totalCycles} · ${tr('覆盖至')}: ${selected.coverageEnd}`
                  : tr('持续重复，未设结束期数')}
              </p>
              <div className={styles.costAcceptShares}>
                <PagedList items={selected.rule.shares}>
                  {(s: any) => (
                    <div>
                      <span>{name(s.userId)}</span>
                      <strong>
                        {formatMoney(s.amount)}
                        <small> / {tr('月')}</small>
                      </strong>
                    </div>
                  )}
                </PagedList>
              </div>
              {bookField}
              <div className={shared.toolbar}>
                <Button variant="primary" type="submit" disabled={busy}>
                  {tr('接受规则并保存账本')}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run('/' + selected.id + '/respond', { version: selected.version, accept: false })
                  }
                >
                  {tr('撤回我的同意')}
                </Button>
              </div>
            </form>
          )}
          {action === 'pay' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                void run('/' + selected.id + '/confirm', {
                  version: selected.version,
                  dueDate: selected.next_date,
                  bookId: paymentMode === 'existing' ? sources.find(s => s.id === source)?.book_id : book,
                  ...(paymentMode === 'existing'
                    ? { transactionId: source }
                    : { accountId: account, paidDate }),
                });
              }}
            >
              <p className={shared.notice}>
                {tr('仅在实际付款后确认。若已通过识图或手动记账，请关联原付款，避免重复记账。')}
              </p>
              <p>
                {tr('本期金额')}{' '}
                <strong>
                  {formatMoney(
                    selected.rule.shares.reduce((n: number, s: any) => n + s.amount, 0) *
                      selected.rule.months,
                  )}
                </strong>
              </p>
              <Field label={tr('付款记录')}>
                {() => (
                  <FormSelect
                    aria-label={tr('付款记录')}
                    value={paymentMode}
                    onChange={next => setPaymentMode(next)}
                  >
                    <option value="new">{tr('已付款，尚未记账')}</option>
                    <option value="existing">{tr('关联已记账的付款')}</option>
                  </FormSelect>
                )}
              </Field>
              {paymentMode === 'new' ? (
                <div className={shared.grid}>
                  {bookField}
                  <Field label={tr('实际付款钱包')}>
                    {() => (
                      <FormSelect
                        aria-label={tr('实际付款钱包')}
                        required
                        value={account}
                        onChange={next => setAccount(next)}
                      >
                        <option value="">{tr('请选择')}</option>
                        {assets.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </FormSelect>
                    )}
                  </Field>
                  <Field label={tr('实际付款日期')}>
                    {control => (
                      <Input
                        {...control}
                        required
                        type="date"
                        value={paidDate}
                        onChange={e => setPaidDate(e.target.value)}
                      />
                    )}
                  </Field>
                </div>
              ) : (
                <>
                  <Field label={tr('搜索原付款')}>
                    {control => (
                      <Input
                        {...control}
                        value={query}
                        onChange={e => {
                          setQuery(e.target.value);
                          setSourceOffset(0);
                          setSource('');
                        }}
                      />
                    )}
                  </Field>
                  {sourceLoading ? (
                    <p role="status">{tr('正在查找…')}</p>
                  ) : (
                    sources.slice(0, 20).map(s => (
                      <label className={shared.check} key={s.id}>
                        <Input
                          required
                          type="radio"
                          name="cost-payment"
                          checked={source === s.id}
                          onChange={() => setSource(s.id)}
                        />
                        {s.title || s.payee} · {s.date} · {formatMoney(s.amount)}
                      </label>
                    ))
                  )}
                  <div className={shared.toolbar}>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={sourceLoading || !sourceOffset}
                      onClick={() => {
                        setSource('');
                        setSourceOffset(v => v - 20);
                      }}
                    >
                      {tr('上一页')}
                    </Button>
                    <span>
                      {sources[0]?.total ? sourceOffset + 1 : 0}–
                      {Math.min(sourceOffset + 20, sources[0]?.total || 0)} / {sources[0]?.total || 0}
                    </span>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={sourceLoading || sources.length <= 20}
                      onClick={() => {
                        setSource('');
                        setSourceOffset(v => v + 20);
                      }}
                    >
                      {tr('下一页')}
                    </Button>
                  </div>
                </>
              )}
              <div className={shared.toolbar}>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={busy || (paymentMode === 'existing' && !source)}
                >
                  {busy ? tr('保存中…') : tr('确认实际付款并分摊')}
                </Button>
              </div>
            </form>
          )}
          {action === 'discussion' && (
            <>
              <div className={shared.toolbar}>
                <Button
                  variant="secondary"
                  type="button"
                  aria-pressed={!discussionScope}
                  onClick={() => setDiscussionScope('')}
                >
                  {tr('计划讨论')}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  aria-pressed={discussionScope === selected.next_date}
                  onClick={() => setDiscussionScope(selected.next_date)}
                >
                  {tr('本期讨论')} · {selected.next_date}
                </Button>
              </div>
              <Discussion
                key={selected.id + discussionScope}
                target={{ kind: 'schedule', id: selected.id, scope: discussionScope }}
              />
            </>
          )}
          {action === 'history' && (
            <>
              {historyLoading && <p role="status">{tr('正在加载账期…')}</p>}
              <PagedList items={historyLoading ? [] : history} pageSize={20}>
                {(h: any) => (
                  <div className={shared.row}>
                    <span>{h.due_date}</span>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setDiscussionScope(h.due_date);
                        setAction('discussion');
                      }}
                    >
                      {tr('讨论本期')}
                    </Button>
                    {h.project_id ? (
                      <Button variant="secondary" onClick={() => onProject(h.project_id)}>
                        {tr('查看分摊与结算')}
                      </Button>
                    ) : (
                      <span>{tr('已跳过')}</span>
                    )}
                  </div>
                )}
              </PagedList>
              {!historyLoading && !error && !history.length && <p>{tr('尚无已处理账期')}</p>}
              <div className={shared.toolbar}>
                <Button
                  variant="secondary"
                  disabled={historyLoading || !historyOffset}
                  onClick={() => setHistoryOffset(v => v - 20)}
                >
                  {tr('上一页')}
                </Button>
                <span>
                  {history[0]?.total ? historyOffset + 1 : 0}–
                  {Math.min(historyOffset + 20, history[0]?.total || 0)} / {history[0]?.total || 0}
                </span>
                <Button
                  variant="secondary"
                  disabled={historyLoading || historyOffset + 20 >= (history[0]?.total || 0)}
                  onClick={() => setHistoryOffset(v => v + 20)}
                >
                  {tr('下一页')}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {loading ? (
            <p role="status">{tr('加载中…')}</p>
          ) : (
            rows.map(s => (
              <div className={shared.row + ' ' + styles.costScheduleCard} key={s.id}>
                <div className={styles.costScheduleSummary}>
                  <ListRow
                    title={s.rule.title}
                    meta={
                      <>
                        {s.completed ? tr('全部账期已处理') : s.next_date} ·{' '}
                        {s.completed
                          ? tr('已结束')
                          : s.paused
                            ? tr('已暂停')
                            : s.members.some((m: any) => !m.accepted)
                              ? tr('待成员同意')
                              : s.due
                                ? tr('到期待确认付款')
                                : tr('未到期，不自动扣款')}
                      </>
                    }
                    end={
                      <Money
                        value={s.rule.shares.reduce((n: number, p: any) => n + p.amount, 0) * s.rule.months}
                      />
                    }
                    endMeta={tr('每期付款')}
                  />
                  <div className={styles.costScheduleAmount}>
                    <small>{tr('每 {0} 个月一次', [s.rule.months])}</small>
                  </div>
                  <small className={styles.costScheduleProgress}>
                    {s.totalCycles
                      ? `${tr('已处理')} ${s.processed} / ${s.totalCycles} · ${tr('覆盖至')} ${s.coverageEnd}`
                      : tr('持续重复')}
                  </small>
                  <div className={styles.costScheduleShares}>
                    {s.rule.shares.map((p: any) => {
                      const received = Number(
                          s.received?.find((v: any) => v.user_id === p.userId)?.amount || 0,
                        ),
                        expected = p.amount * s.rule.months;
                      return (
                        <span key={p.userId}>
                          {s.members.find((m: any) => m.user_id === p.userId)?.name || name(p.userId)}
                          <strong>
                            {formatMoney(p.amount)}
                            <small> / {tr('月')}</small>
                          </strong>
                          <small>
                            {s.members.find((m: any) => m.user_id === p.userId)?.accepted
                              ? tr('已确认规则')
                              : tr('待确认规则')}
                          </small>
                          {received > 0 && (
                            <small>
                              {tr('本期已付')}: {formatMoney(received)} / {formatMoney(expected)}
                            </small>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className={shared.toolbar}>
                  <Button variant="secondary" disabled={busy} onClick={() => open(s, 'respond')}>
                    {tr('我的归属与确认')}
                  </Button>
                  {s.owner_id === options?.userId && (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          open(s, 'edit');
                          setRule({ ...s.rule });
                        }}
                      >
                        {tr('编辑计划')}
                      </Button>
                      <Button
                        variant="primary"
                        disabled={busy || !s.due || s.members.some((m: any) => !m.accepted)}
                        onClick={() => open(s, 'pay')}
                      >
                        {tr('确认本期付款')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run('/' + s.id + '/pause', { version: s.version, paused: !s.paused })}
                      >
                        {s.paused ? tr('恢复') : tr('暂停')}
                      </Button>
                    </>
                  )}
                  {s.members.some((m: any) => m.user_id === options?.userId && m.accepted) &&
                    !s.completed && (
                      <Button
                        variant="secondary"
                        disabled={
                          busy ||
                          !s.rule.shares.some(
                            (p: any) =>
                              p.userId !== options?.userId &&
                              p.amount * s.rule.months >
                                Number(s.received?.find((v: any) => v.user_id === p.userId)?.amount || 0),
                          )
                        }
                        onClick={() => open(s, 'receive')}
                      >
                        {tr('确认本期分摊到账')}
                      </Button>
                    )}
                  <Button variant="secondary" type="button" onClick={() => open(s, 'discussion')}>
                    {tr('讨论')}
                  </Button>
                  <Button variant="ghost" onClick={() => open(s, 'history')}>
                    {tr('账期记录')}
                  </Button>
                </div>
              </div>
            ))
          )}
          {!loading && !rows.length && (
            <p className={shared.muted}>
              {tr('尚无周期计划。可提前规划房租、保险或服务费用，到期再确认实付。')}
            </p>
          )}
          <div className={shared.toolbar}>
            <Button variant="secondary" disabled={!offset || loading} onClick={() => setOffset(v => v - 20)}>
              {tr('上一页')}
            </Button>
            <span>
              {offset / 20 + 1} / {Math.max(1, Math.ceil((rows[0]?.total || 0) / 20))}
            </span>
            <Button
              variant="secondary"
              disabled={loading || offset + 20 >= (rows[0]?.total || 0)}
              onClick={() => setOffset(v => v + 20)}
            >
              {tr('下一页')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
