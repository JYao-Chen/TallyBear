'use client';
import { FormSelect } from './FormSelect';
import { participantAvatar } from '@/ui/participantAvatar';
import {
  Button,
  Card,
  ChipButton,
  ConfirmDialog,
  Field,
  Input,
  ListRow,
  Sheet,
  Money,
  Segmented,
  Stat,
  TextArea,
} from '@/ui';
import s from './FamilyFinance.module.css';
import { DetailSortSelect } from './DetailSortSelect';
import { sortDetails, type DetailSort } from '@/lib/detail-sort';
import { useI18n } from './LanguageProvider';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, Plus, Check } from 'lucide-react';
import { TransferIcon, VisualSelect } from './VisualSelect';
import { FamilyMovementDetails } from './FamilyMovementDetails';
import type { ReactNode } from 'react';
import { TransactionRow } from './TransactionList';
import { PagedList } from './PagedList';
import type { familyOverview } from '@/server/reports';
import { recordingDate } from '@/lib/entry-time';
import { monthRange } from '@/lib/ledger-types';
import { DateField } from './DateField';
import { formatMoney } from '@/lib/deployment';
import { amountToCents } from '@/server/model';
const kinds: Record<string, string> = {
  transfer: '普通转账',
  gift: '红包赠送',
  aa: 'AA 结算',
  loan: '借出款',
  repayment: '归还借款',
  contribution: '家庭缴款',
};
export function FamilyFinance({
  family,
  userId,
  onChanged,
  showOverviewTab = true,
  revision = 0,
}: {
  showOverviewTab?: boolean;
  revision?: number;
  family: string;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const section = useRef<HTMLElement>(null);
  const [cancelId, setCancelId] = useState('');
  const [sort, setSort] = useState<DetailSort>('date_desc');
  const { t: tr } = useI18n();
  const [receiverType, setReceiverType] = useState('member');
  const [view, setView] = useState('records'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState(''),
    [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [displayBook, setDisplayBook] = useState<string | null>(null),
    [organize, setOrganize] = useState<any>(null),
    [requestId, setRequestId] = useState(''),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [open, setOpen] = useState(false),
    [confirm, setConfirm] = useState<any>(null),
    [kind, setKind] = useState('transfer'),
    [source, setSource] = useState(''),
    [recipient, setRecipient] = useState(''),
    [target, setTarget] = useState(''),
    [link, setLink] = useState(''),
    [split, setSplit] = useState<any>(null),
    [shares, setShares] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open || split) section.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [open, split]);
  async function api(body?: unknown) {
    const r = await fetch('/api/family-finance/' + family, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function load() {
    setData(await api());
  }
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [family, revision]);
  async function save(body: unknown) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(body);
      await load();
      await onChanged();
      setOpen(false);
      setConfirm(null);
      setSplit(null);
      setCancelId('');
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <Card role="status">{tr(error || '正在读取家庭资金往来…')}</Card>;
  const wallets = data.wallets.map((a: any) => ({
    value: a.id,
    label: a.name + (a.family_id ? tr(' · 家庭共有') : ''),
    account: true,
    accountName: a.institution || a.name,
  }));
  const people = data.people
    .filter((p: any) => p.id !== userId)
    .map((p: any) => ({ value: p.id, label: p.name, icon: participantAvatar(p.avatar) }));
  const contributionLabel = tr('家庭缴款');
  const kindLabel = (value: string) => (value === 'contribution' ? contributionLabel : tr(kinds[value]));
  const isContribution =
    kind === 'transfer' &&
    data.wallets.some((a: any) => a.id === source && a.owner_id === userId) &&
    data.wallets.some((a: any) => a.id === target && a.family_id === family);
  const aa = data.expenses.filter((e: any) => e.shares);
  const editingPanel = !!(open || split);
  const filtered = sortDetails<any>(
    data.movements.filter(
      (m: any) =>
        (!filter || m.status === filter) &&
        [
          m.sender_name,
          m.recipient_name,
          m.source_name,
          m.target_name,
          m.details?.title,
          m.note,
          m.details?.note,
          m.details?.external_id ?? m.external_id,
          m.details?.platform ?? m.platform,
          kindLabel(m.kind),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    sort,
    m => ({
      date: String(m.date).slice(0, 10),
      time: m.details?.transaction_time,
      created: m.created_at,
      amount: m.amount,
      id: m.id,
    }),
  );
  return (
    <section ref={section} className={s.finance} aria-label={tr('家庭资金往来')}>
      {!editingPanel && (
        <>
          <div className={s.heading}>
            <h2>
              <ArrowLeftRight size={22} />
              {tr('家庭资金往来')}
            </h2>
            <Button
              variant="primary"
              onClick={() => {
                setDisplayBook(data.defaultBookId);
                setRequestId(crypto.randomUUID());
                setKind('transfer');
                setReceiverType('member');
                setSource('');
                setRecipient('');
                setTarget('');
                setLink('');
                setError('');
                setOpen(true);
              }}
            >
              <Plus size={18} />
              {tr('记一笔往来')}
            </Button>
          </div>

          {error && !open && !confirm && !split && <p className={s.error}>{error}</p>}
          <Segmented
            className={s.tabs}
            label={tr('家庭往来栏目')}
            value={view}
            onChange={setView}
            options={[
              { value: 'records', label: tr('往来记录') },
              { value: 'aa', label: tr('费用分担 / AA') },
              ...(showOverviewTab ? [{ value: 'contributions', label: tr('家庭总览') }] : []),
            ]}
          />
          {view === 'contributions' && <FamilyOverview family={family} revision={revision} />}
          {view === 'aa' && (
            <section>
              <h3>{tr('费用分担 / AA')}</h3>
              <p className={s.muted}>{tr('由实际付款人设置承担金额；成员完成结算后更新进度。')}</p>
              {data.expenses.filter((e: any) => e.owner_id === userId).length > 0 && (
                <VisualSelect
                  label={tr('设置费用分担')}
                  value=""
                  onChange={id => {
                    const e = data.expenses.find((e: any) => e.id === id);
                    setSplit(e);
                    setError('');
                    setShares(
                      Object.fromEntries(
                        data.people.map((p: any) => [
                          p.id,
                          String((e.shares?.find((s: any) => s.userId === p.id)?.amount || 0) / 100),
                        ]),
                      ),
                    );
                  }}
                  options={[
                    { value: '', label: tr('选择我已支付的家庭消费，设置分担') },
                    ...data.expenses
                      .filter((e: any) => e.owner_id === userId)
                      .map((e: any) => ({
                        value: e.id,
                        label: (e.title || e.payee) + ' · ' + formatMoney(e.amount),
                      })),
                  ]}
                />
              )}
              <PagedList items={aa}>
                {(e: any) => (
                  <article className={s.share} key={e.id}>
                    <strong>
                      {e.title || e.payee} · {formatMoney(e.amount)}
                    </strong>
                    <div>
                      {e.shares.map((s: any) => {
                        const paid = s.paid || 0;
                        return (
                          <p key={s.userId}>
                            {data.people.find((p: any) => p.id === s.userId)?.name || tr('原成员')}
                            {tr('：承担 ')}
                            {formatMoney(s.amount)}
                            {s.userId !== e.owner_id &&
                              tr(' · 已结算 {0} · 待结算 {1}', [
                                formatMoney(paid),
                                formatMoney(Math.max(0, s.amount - paid)),
                              ])}
                          </p>
                        );
                      })}
                    </div>
                  </article>
                )}
              </PagedList>
              {!aa.length && <p className={s.muted}>{tr('还没有设置分担的家庭消费。')}</p>}
            </section>
          )}
          {view === 'records' && (
            <>
              <div className={s.toolbar}>
                <Input
                  aria-label={tr('搜索往来')}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={tr('成员、备注、用途、流水号…')}
                />
                <FormSelect aria-label={tr('往来状态')} value={filter} onChange={next => setFilter(next)}>
                  <option value="">{tr('全部状态')}</option>
                  <option value="pending">{tr('待收款人确认')}</option>
                  <option value="confirmed">{tr('已确认')}</option>
                  <option value="cancelled">{tr('已取消')}</option>
                </FormSelect>
                <DetailSortSelect picker value={sort} onChange={setSort} />
              </div>
              <p className={s.muted}>
                {tr('共 ')}
                {filtered.length} {tr(' 笔往来 · 内部资金流动不计家庭消费')}
              </p>
              <PagedList items={filtered} resetKey={query + filter + sort}>
                {(m: any) => (
                  <TransactionRow
                    onClick={() => setSelected(m)}
                    icon={<TransferIcon />}
                    title={[
                      m.details?.title,
                      m.sender_name + ' → ' + (m.recipient_name || m.target_name),
                      kindLabel(m.kind),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    meta={
                      <>
                        <span>
                          {m.date} ·{' '}
                          {m.status === 'pending'
                            ? tr('待收款人确认')
                            : m.status === 'confirmed'
                              ? tr('已确认')
                              : tr('已取消')}
                          {m.note ? ' · ' + tr('转账留言：{0}', [m.note]) : ''}
                          {m.details?.note && m.details.note !== m.note
                            ? ' · ' + tr('私人备注：{0}', [m.details.note])
                            : ''}
                        </span>
                        {m.kind === 'loan' && m.status === 'confirmed' && (
                          <small>
                            {tr('未归还 ')}
                            {formatMoney(
                              Math.max(
                                0,
                                m.amount -
                                  data.movements
                                    .filter((v: any) => v.loan_id === m.id && v.status === 'confirmed')
                                    .reduce((n: number, v: any) => n + v.amount, 0),
                              ),
                            )}
                          </small>
                        )}
                      </>
                    }
                    value={
                      <strong>
                        <Money value={m.amount} />
                      </strong>
                    }
                  />
                )}
              </PagedList>
              {!filtered.length && (
                <p className={s.muted}>{tr('没有符合条件的往来记录，可以调整筛选或记一笔往来。')}</p>
              )}
            </>
          )}
        </>
      )}
      {selected && (
        <FamilyMovementDetails
          row={{
            id: selected.id,
            movement_family_id: family,
            amount: selected.amount,
            title: selected.details?.title || kindLabel(selected.kind),
            account_name: selected.source_name || selected.target_name || tr('对方钱包'),
          }}
          actions={
            <>
              {[selected.sender_id, selected.recipient_id].includes(userId) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setError('');
                    setOrganize(selected);
                    setDisplayBook(selected.displayBookId);
                  }}
                >
                  {tr('展示账本')}
                </Button>
              )}
              {selected.status === 'pending' && (
                <>
                  {selected.recipient_id === userId && (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setDisplayBook(data.defaultBookId);
                        setReply('');
                        setConfirm(selected);
                        setTarget('');
                        setError('');
                      }}
                    >
                      <Check size={16} />
                      {tr('确认到账')}
                    </Button>
                  )}
                  {[selected.sender_id, selected.recipient_id].includes(userId) && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setCancelId(selected.id);
                      }}
                    >
                      {tr('取消往来')}
                    </Button>
                  )}
                </>
              )}
            </>
          }
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await load();
            await onChanged();
          }}
        />
      )}
      {organize && (
        <Sheet
          open
          title={tr('调整我的展示账本')}
          onClose={() => {
            if (!busy) setOrganize(null);
          }}
        >
          <VisualSelect
            label={tr('展示账本')}
            value={displayBook || ''}
            onChange={v => setDisplayBook(v || null)}
            options={[
              { value: '', label: tr('仅家庭往来') },
              ...(data.books || []).map((b: any) => ({ value: b.id, label: b.name, icon: b.icon })),
            ]}
          />
          <Button
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                await api({ operation: 'display', id: organize.id, displayBookId: displayBook });
                await load();
                await onChanged();
                setOrganize(null);
                setSelected(null);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr('保存展示位置')}
          </Button>
          {error && <p className={s.error}>{error}</p>}
        </Sheet>
      )}

      {open && (
        <FamilyPanel
          title={isContribution || kind === 'contribution' ? contributionLabel : tr('记一笔家庭往来')}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                save({
                  operation: 'create',
                  displayBookId: displayBook,
                  id: requestId,
                  kind: isContribution ? 'contribution' : kind,
                  sourceId: source,
                  ...(target ? { targetId: target } : { recipientId: recipient }),
                  amount: amountToCents(String(f.get('amount'))),
                  date: f.get('date'),
                  note: f.get('note'),
                  allowSimilar: f.get('allowSimilar') === 'on',
                  ...(kind === 'aa' ? { expenseId: link } : kind === 'repayment' ? { loanId: link } : {}),
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <fieldset disabled={busy}>
              <label>
                {tr('用途')}
                <VisualSelect
                  label={tr('用途')}
                  value={kind}
                  onChange={v => {
                    setKind(v);
                    setReceiverType(v === 'contribution' ? 'wallet' : 'member');
                    setTarget('');
                    setRecipient('');
                    setLink('');
                  }}
                  options={Object.keys(kinds).map(value => ({ value, label: kindLabel(value) }))}
                />
              </label>
              <label>
                {tr('转出钱包')}
                <VisualSelect
                  label={tr('转出钱包')}
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: '', label: tr('请选择') },
                    ...wallets.filter(
                      (w: any) =>
                        kind === 'transfer' ||
                        data.wallets.find((a: any) => a.id === w.value)?.owner_id === userId,
                    ),
                  ]}
                />
              </label>
              {kind === 'transfer' && (
                <label>
                  {tr('收款对象')}
                  <FormSelect
                    value={receiverType}
                    onChange={next => {
                      setReceiverType(next);
                      setTarget('');
                      setRecipient('');
                    }}
                  >
                    <option value="member">{tr('家庭成员（由对方确认到账）')}</option>
                    <option value="wallet">{tr('自己的钱包 / 家庭共同钱包')}</option>
                  </FormSelect>
                </label>
              )}
              {kind !== 'contribution' && receiverType === 'member' && (
                <label>
                  {tr('收款成员（由对方选择到账钱包）')}
                  <VisualSelect
                    label={tr('收款成员')}
                    value={recipient}
                    onChange={v => {
                      setRecipient(v);
                      setTarget('');
                      setLink('');
                    }}
                    options={[{ value: '', label: tr('请选择') }, ...people]}
                  />
                </label>
              )}
              {['transfer', 'contribution'].includes(kind) && receiverType === 'wallet' && (
                <label>
                  {tr('转入自己的／家庭钱包')}
                  <VisualSelect
                    label={tr('转入钱包')}
                    value={target}
                    onChange={v => {
                      setTarget(v);
                      setRecipient('');
                    }}
                    options={[
                      { value: '', label: tr('请选择') },
                      ...wallets.filter(
                        (w: any) =>
                          (kind === 'transfer' ||
                            data.wallets.find((a: any) => a.id === w.value)?.family_id) &&
                          w.value !== source,
                      ),
                    ]}
                  />
                </label>
              )}
              {['aa', 'repayment'].includes(kind) && (
                <label>
                  {kind === 'aa' ? tr('关联消费') : tr('关联借款')}
                  <VisualSelect
                    label={tr('关联记录')}
                    value={link}
                    onChange={setLink}
                    options={[
                      { value: '', label: tr('请选择') },
                      ...(kind === 'aa'
                        ? aa
                            .filter((e: any) => e.owner_id === recipient)
                            .map((e: any) => ({
                              value: e.id,
                              label: (e.title || e.payee) + ' · ' + formatMoney(e.amount),
                            }))
                        : data.movements
                            .filter(
                              (m: any) =>
                                m.kind === 'loan' &&
                                m.status === 'confirmed' &&
                                m.sender_id === recipient &&
                                m.recipient_id === userId,
                            )
                            .map((m: any) => ({
                              value: m.id,
                              label: m.date + ' · ' + formatMoney(m.amount),
                            }))),
                    ]}
                  />
                </label>
              )}
              <div className={s.filters}>
                <Field label={tr('金额')}>
                  {control => <Input {...control} name="amount" inputMode="decimal" required />}
                </Field>
                <label>
                  {tr('日期')}
                  <DateField name="date" type="date" defaultValue={recordingDate()} required />
                </label>
              </div>
              <label>
                {tr('展示在我的账本')}
                <VisualSelect
                  label={tr('展示账本')}
                  value={displayBook || ''}
                  onChange={v => setDisplayBook(v || null)}
                  options={[
                    { value: '', label: tr('仅家庭往来') },
                    ...(data.books || []).map((b: any) => ({ value: b.id, label: b.name, icon: b.icon })),
                  ]}
                />
              </label>
              <Field label={tr('转账留言 · 双方可见')}>
                {control => <Input {...control} name="note" maxLength={500} />}
              </Field>
              {error && <p className={s.error}>{error}</p>}
              {/同日|same date/i.test(error) && (
                <label className={s.checkbox}>
                  <input type="checkbox" name="allowSimilar" />
                  {tr('已核对，确实是另一笔转账')}
                </label>
              )}
              <Button type="submit" variant="primary" disabled={!source || (!target && !recipient)}>
                {tr('保存往来')}
              </Button>
            </fieldset>
          </form>
        </FamilyPanel>
      )}
      {confirm && (
        <Sheet
          open
          title={tr('确认到账')}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p>
            {confirm.sender_name} · {formatMoney(confirm.amount)}
          </p>
          <VisualSelect
            label={tr('展示在我的账本')}
            value={displayBook || ''}
            onChange={v => setDisplayBook(v || null)}
            options={[
              { value: '', label: tr('仅家庭往来') },
              ...(data.books || []).map((b: any) => ({ value: b.id, label: b.name, icon: b.icon })),
            ]}
          />
          <VisualSelect
            label={tr('实际到账钱包')}
            value={target}
            onChange={setTarget}
            options={[
              { value: '', label: tr('请选择实际到账钱包') },
              ...wallets.filter(
                (w: any) => data.wallets.find((a: any) => a.id === w.value)?.owner_id === userId,
              ),
            ]}
          />
          {error && <p className={s.error}>{error}</p>}
          <Field label={tr('回复转账人（选填，对方可见）')}>
            {control => (
              <TextArea
                {...control}
                maxLength={2000}
                rows={2}
                value={reply}
                disabled={busy}
                onChange={e => setReply(e.target.value)}
              />
            )}
          </Field>
          <Button
            disabled={busy || !target}
            onClick={() =>
              save({
                operation: 'confirm',
                displayBookId: displayBook,
                id: confirm.id,
                targetId: target,
                reply,
              })
            }
          >
            {tr('确认到账')}
          </Button>
        </Sheet>
      )}
      {split && (
        <FamilyPanel
          title={tr('设置费用承担')}
          onClose={() => {
            if (!busy) setSplit(null);
          }}
        >
          <p>
            {split.title || split.payee} · {formatMoney(split.amount)}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              const base = Math.floor(split.amount / data.people.length);
              setShares(
                Object.fromEntries(
                  data.people.map((p: any, i: number) => [
                    p.id,
                    String((base + (i < split.amount % data.people.length ? 1 : 0)) / 100),
                  ]),
                ),
              );
            }}
          >
            {tr('所有成员平均分担')}
          </Button>
          {data.people.map((p: any) => (
            <label key={p.id}>
              {p.name}
              <Input
                inputMode="decimal"
                value={shares[p.id] || ''}
                onChange={e => setShares(v => ({ ...v, [p.id]: e.target.value }))}
              />
            </label>
          ))}
          {error && <p className={s.error}>{error}</p>}
          <Button
            disabled={busy}
            onClick={() => {
              try {
                save({
                  operation: 'shares',
                  transactionId: split.id,
                  shares: data.people.map((p: any) => ({
                    userId: p.id,
                    amount: amountToCents(shares[p.id] || '0'),
                  })),
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {tr('保存分担')}
          </Button>
        </FamilyPanel>
      )}
      {cancelId && (
        <ConfirmDialog
          open
          title={tr('取消往来')}
          busy={busy}
          onCancel={() => {
            if (!busy) setCancelId('');
          }}
          onConfirm={() => void save({ operation: 'cancel', id: cancelId })}
        >
          <p>{tr('取消这笔待确认往来？')}</p>
          {error && (
            <p role="alert" className={s.error}>
              {tr(error)}
            </p>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}

function FamilyPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t: tr } = useI18n();
  return (
    <section className={s.editor}>
      <Button type="button" variant="ghost" onClick={onClose}>
        <ArrowLeft size={16} aria-hidden />
        {tr('返回家庭往来')}
      </Button>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function FamilyOverview({ family, revision }: { family: string; revision: number }) {
  const { t: tr } = useI18n();
  const [period, setPeriod] = useState('本月');
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof familyOverview>> | null>(null);
  const [error, setError] = useState('');
  const current = monthRange(recordingDate().slice(0, 7));
  const start = new Date(current.from + 'T00:00:00Z');
  start.setUTCMonth(start.getUTCMonth() - (period === '上月' ? 1 : period === '近 3 月' ? 2 : 0));
  const from = start.toISOString().slice(0, 10);
  const to = period === '上月' ? monthRange(from.slice(0, 7)).to : current.to;
  useEffect(() => {
    const controller = new AbortController();
    setOverview(null);
    setError('');
    const params = new URLSearchParams({ familyId: family, from, to });
    fetch('/api/family-finance/overview?' + params, { signal: controller.signal })
      .then(async r => {
        const value = await r.json();
        if (!r.ok) throw Error(value.error);
        if (!controller.signal.aborted) setOverview(value);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [family, from, to, revision]);
  const maximum = Math.max(1, ...(overview?.contributions.map(c => c.amount) || []));
  return (
    <Card aria-label={tr('家庭总览')} title={tr('家庭总览')}>
      <div className={s.period} role="group" aria-label={tr('统计周期')}>
        {['本月', '上月', '近 3 月'].map(p => (
          <ChipButton key={p} selected={period === p} onClick={() => setPeriod(p)}>
            {tr(p)}
          </ChipButton>
        ))}
        <small>
          {from} — {to}
        </small>
      </div>
      {error ? (
        <p role="alert" className={s.error}>
          {tr(error)}
        </p>
      ) : !overview ? (
        <p role="status">{tr('正在读取…')}</p>
      ) : (
        <>
          <div className={s.balances}>
            <Stat label={tr('期初余额')}>
              <Money value={overview.openingBalance} />
            </Stat>
            <Stat label={tr('期末余额')}>
              <Money value={overview.closingBalance} />
            </Stat>
            <Stat label={tr('本期结余')}>
              <Money value={overview.surplus} tone="signed" />
            </Stat>
          </div>
          <div className={s.breakdown}>
            <section>
              <h3>{tr('家庭缴款')}</h3>
              {overview.contributions.map(c => (
                <div className={s.contribution} key={c.id}>
                  <span>{c.name}</span>
                  <Money value={c.amount} className={s.income} />
                  <progress aria-hidden="true" max={maximum} value={c.amount} />
                </div>
              ))}
            </section>
            <section>
              <div className={s.total}>
                <h3>{tr('共同费用')}</h3>
                <Money value={overview.commonExpense} className={s.expense} />
              </div>
              {overview.categories.length ? (
                overview.categories.map(c => (
                  <div className={s.category} key={c.name}>
                    <span>{tr(c.name)}</span>
                    <Money value={c.amount} />
                  </div>
                ))
              ) : (
                <p className={s.muted}>{tr('本期暂无共同费用')}</p>
              )}
              <div className={s.claimed}>
                <span>{tr('已认领个人费用')}</span>
                <Money value={overview.claimedExpense} />
              </div>
            </section>
          </div>
        </>
      )}
    </Card>
  );
}
