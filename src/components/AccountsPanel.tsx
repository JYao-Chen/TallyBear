'use client';
import { FormSelect } from './FormSelect';
import { Button, Card, Field, Input, Sheet, Money, Stat, ListRow, ConfirmDialog, EmptyState } from '@/ui';
import styles from './AccountsPanel.module.css';
import shared from './WorkspacePlans.module.css';
import { recordingDate } from '@/lib/entry-time';
import { PagedList } from './PagedList';

import { deployment } from '@/lib/deployment';
import { getLocale } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';
import { monthRange, type LedgerReport, type LedgerRow } from '@/lib/ledger-types';
import { ReportPeriodPicker } from './ReportPeriodPicker';
import { WalletFundsPanel } from './WalletFundsPanel';
import { TransactionList } from './TransactionList';

import { accountTypes, accountLabel, type WalletOwnership, type AccountType } from '@/lib/accounts';
import { AccountStatistics } from './AccountStatistics';
import { VisualSelect, AccountIcon } from './VisualSelect';
import { useEffect, useRef, useState } from 'react';
import { Plus, Archive, RotateCcw } from 'lucide-react';
import { amountToCents } from '@/server/model';
export type Account = {
  owner_id?: string;
  family_id?: string;
  owner_name?: string;
  usable?: boolean;
  id: string;
  ownership?: WalletOwnership;
  name: string;
  balance: number;
  opening: number;
  archived: boolean;
  version: number;
  type?: AccountType;
  holder?: string;
  institution?: string;
  suffix?: string;
};
const yuan = (n: number) =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency: deployment().currency }).format(n / 100);
const signedCents = (s: string) => (s.startsWith('-') ? -amountToCents(s.slice(1)) : amountToCents(s));
export function AccountsPanel({
  book,
  books,
  month,
  onSelect,
  onChanged,
}: {
  book: string;
  books?: readonly { id: string }[];
  month: string;
  onSelect?: (row: LedgerRow) => void;
  onChanged: () => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [allAccounts, setAccounts] = useState<Account[]>([]),
    [families, setFamilies] = useState<{ id: string; name: string }[]>([]),
    [scope, setScope] = useState('personal');
  const accounts = allAccounts.filter(a => (scope === 'personal' ? !!a.owner_id : a.family_id === scope)),
    canWrite = true;
  async function request(method: string, body?: unknown, historyId?: string, merge = false) {
    const response = await fetch(
      merge ? '/api/assets/merge' : historyId ? '/api/assets/history?account=' + historyId : '/api/assets',
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
      },
    );
    const d = await response.json();
    if (!response.ok) throw new Error(d.error);
    return d;
  }
  async function reload() {
    try {
      const wallets: Account[] = await request('GET');
      setAccounts(wallets);
      setSelected(previous =>
        previous ? (wallets.find(wallet => wallet.id === previous.id) ?? null) : null,
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload().catch(e => setError(e.message));
    fetch('/api/families')
      .then(r => r.json())
      .then(d => setFamilies(d.items || []))
      .catch(e => setError(e.message));
  }, []);

  const historyAccount = useRef('');
  const [mergeTarget, setMergeTarget] = useState(''),
    [mergeBalance, setMergeBalance] = useState('');
  const [selected, setSelected] = useState<Account | null>(null),
    [mode, setMode] = useState<'detail' | 'edit' | 'reconcile' | 'new' | 'merge'>('detail'),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [history, setHistory] = useState<
      {
        id: string;
        amount: number;
        note: string;
        effective_date: string;
        created_at: string;
        creator: string;
      }[]
    >([]),
    [showArchived, setShowArchived] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    label: string;
    detail: string;
    action: () => void;
  } | null>(null);
  const formScope = selected ? selected.family_id || 'personal' : scope;
  const mergeCandidates = selected
    ? allAccounts.filter(
        a => a.id !== selected.id && !a.archived && (a.family_id || 'personal') === formScope,
      )
    : [];
  const visible = allAccounts.filter(a => showArchived || !a.archived);
  const total = accounts.reduce((n, a) => n + a.balance, 0);
  const assets = accounts.reduce((n, a) => n + Math.max(0, a.balance), 0);
  const groups = [
    { id: 'personal', label: tr('个人') },
    ...families.map(f => ({ id: f.id, label: f.name + ' · ' + tr('家庭') })),
  ];
  function show(a: Account) {
    historyAccount.current = a.id;
    setSelected(a);
    setMode('detail');
    setError('');
    setHistory([]);
    setOpen(true);
    request('GET', undefined, a.id)
      .then(data => {
        if (historyAccount.current === a.id) setHistory(data as typeof history);
      })
      .catch(e => {
        if (historyAccount.current === a.id) setError(e.message);
      });
  }
  async function submit(body: unknown, method = 'PATCH', merge = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await request(method, body, undefined, merge);
      await reload();
      await onChanged();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作未完成');
    } finally {
      setBusy(false);
    }
  }
  const scopeLabel =
    scope === 'personal' ? tr('我的资产') : families.find(f => f.id === scope)?.name || tr('家庭资产');
  return (
    <>
      <div className={shared.heading}>
        <h1>{tr('资金资产')}</h1>
        <div className={styles.scope}>
          <FormSelect aria-label={tr('资产归属')} value={scope} onChange={setScope}>
            <option value="personal">{tr('我的资产')}</option>
            {families.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} · {tr('家庭资产')}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>
      {error && !open && <p className={shared.error}>{tr(error)}</p>}
      <AccountStatistics
        book={book}
        month={month}
        revision={allAccounts}
        scope={scope}
        scopeLabel={scopeLabel}
        onChanged={async () => {
          await reload();
          await onChanged();
        }}
      >
        {summary => (
          <>
            {!loading && !error && (
              <Card className={styles.stats} aria-label={scopeLabel}>
                <Stat label={tr('资产')}>
                  <Money value={assets} />
                </Stat>
                <Stat label={tr('负债')}>
                  <Money value={assets - total} />
                </Stat>
                <Stat label={tr('当前资产净值')}>
                  <Money value={total} />
                </Stat>
                {summary && (
                  <small className={styles.composition}>
                    {tr('银行存款')} {yuan(summary.bankDeposits)} · {tr('零钱与现金')}{' '}
                    {yuan(summary.walletAndCash)}
                  </small>
                )}
              </Card>
            )}
            <Card className={shared.panel}>
              <div className={shared.heading}>
                <h2>{tr('资金钱包')}</h2>
                {canWrite && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelected(null);
                      setMode('new');
                      setError('');
                      setOpen(true);
                    }}
                  >
                    <Plus size={18} />
                    {tr('添加')}
                  </Button>
                )}
              </div>
              {groups.map(group => {
                const wallets = visible.filter(a => (a.family_id || 'personal') === group.id);
                if (!wallets.length) return null;
                return (
                  <section key={group.id} className={styles.group}>
                    <h3>{group.label}</h3>
                    <PagedList
                      items={wallets}
                      resetKey={group.id}
                      container={rows => <div className={styles.walletGrid}>{rows}</div>}
                    >
                      {a => (
                        <ListRow
                          className={styles.wallet}
                          onClick={() => show(a)}
                          leading={
                            <AccountIcon
                              name={[a.institution, a.name, a.type].filter(Boolean).join(' ')}
                              size={32}
                            />
                          }
                          title={accountLabel({ ...a, suffix: '' }, locale)}
                          meta={[
                            a.suffix && tr('尾号 {0}', [a.suffix]),
                            a.archived && tr('已归档 · 历史流水保留'),
                            a.type === 'credit' && tr('账单日未记录'),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          end={<Money value={a.balance} />}
                          endMeta={
                            a.type === 'credit' && (
                              <>
                                {tr('欠款')} <Money value={Math.max(0, -a.balance)} />
                              </>
                            )
                          }
                        />
                      )}
                    </PagedList>
                  </section>
                );
              })}
              {loading && (
                <p role="status" className={shared.muted}>
                  {tr('正在读取钱包…')}
                </p>
              )}
              {!loading && !error && !visible.length && (
                <EmptyState title={tr('还没有可用账户，添加或恢复一个账户即可开始记账。')} />
              )}
              {allAccounts.some(a => a.archived) && (
                <Button variant="ghost" onClick={() => setShowArchived(s => !s)}>
                  {showArchived ? tr('隐藏已归档账户') : tr('查看已归档账户')}
                </Button>
              )}
            </Card>
          </>
        )}
      </AccountStatistics>
      {open && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={
            mode === 'merge'
              ? tr('合并钱包')
              : mode === 'new'
                ? tr('添加资金账户')
                : mode === 'edit'
                  ? tr('修改账户')
                  : mode === 'reconcile'
                    ? tr('核对实际余额')
                    : selected?.name || tr('账户')
          }
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {error && (
            <p className={shared.error} role="alert">
              {tr(error)}
            </p>
          )}
          {mode === 'merge' && selected ? (
            <form
              className={shared.form}
              onSubmit={e => {
                e.preventDefault();
                const target = mergeCandidates.find(a => a.id === mergeTarget);
                if (!target) return;
                try {
                  const balance = signedCents(mergeBalance);
                  setConfirmation({
                    label: tr('确认合并钱包'),
                    detail: accountLabel(selected) + ' → ' + accountLabel(target) + ' · ' + yuan(balance),
                    action: () =>
                      submit(
                        {
                          id: selected.id,
                          targetId: target.id,
                          version: selected.version,
                          targetVersion: target.version,
                          expectedBalance: selected.balance,
                          expectedTargetBalance: target.balance,
                          balance,
                        },
                        'POST',
                        true,
                      ),
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p>
                {accountLabel(selected)} · {yuan(selected.balance)}
              </p>
              <label>
                {tr('合并到哪个钱包')}
                <VisualSelect
                  label={tr('选择保留的钱包')}
                  value={mergeTarget}
                  disabled={busy}
                  onChange={id => {
                    setMergeTarget(id);
                    setMergeBalance(
                      String(
                        (selected.balance + (mergeCandidates.find(a => a.id === id)?.balance || 0)) / 100,
                      ),
                    );
                  }}
                  options={mergeCandidates.map(a => ({
                    value: a.id,
                    label: accountLabel(a),
                    account: true,
                    accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                  }))}
                />
              </label>
              <Field label={tr('合并后的实际余额')}>
                {control => (
                  <Input
                    {...control}
                    className={shared.numeric}
                    inputMode="decimal"
                    required
                    value={mergeBalance}
                    onChange={e => setMergeBalance(e.target.value)}
                  />
                )}
              </Field>
              <div className={shared.notice}>
                <p>
                  {tr(
                    '流水、校准、草稿与周期计划转入保留的钱包，原钱包删除。默认合计两个余额；如果余额曾重复录入，请填写真实余额。账本归属不变。',
                  )}
                </p>
              </div>
              <div className={shared.actions}>
                <Button variant="secondary" type="button" disabled={busy} onClick={() => setMode('detail')}>
                  {tr('取消')}
                </Button>
                <Button variant="primary" type="submit" disabled={busy || !mergeTarget}>
                  {tr('确认合并钱包')}
                </Button>
              </div>
            </form>
          ) : mode === 'new' || mode === 'edit' ? (
            <form
              className={shared.form}
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const body = {
                    familyId: formScope === 'personal' ? null : formScope,
                    name: String(f.get('name')),
                    opening: signedCents(String(f.get('opening') || '0')),
                    type: String(f.get('type')),
                    holder: String(f.get('holder') || ''),
                    institution: String(f.get('institution') || ''),
                    suffix: String(f.get('suffix') || ''),
                  };
                  if (mode === 'new') {
                    void submit(body, 'POST');
                  } else if (selected) {
                    const save = () =>
                      submit({ ...body, id: selected.id, version: selected.version, operation: 'edit' });
                    if (body.opening === selected.opening) void save();
                    else
                      setConfirmation({
                        label: tr('修改期初余额'),
                        detail:
                          accountLabel(selected) +
                          ' · ' +
                          yuan(selected.opening) +
                          ' → ' +
                          yuan(body.opening),
                        action: save,
                      });
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p className={shared.muted}>
                {formScope === 'personal'
                  ? tr('归属：我个人')
                  : tr('归属家庭：') + families.find(f => f.id === formScope)?.name}
              </p>
              <Field label={tr('账户类型')}>
                {() => (
                  <FormSelect aria-label={tr('账户类型')} name="type" defaultValue={selected?.type || 'bank'}>
                    {Object.entries(accountTypes).map(([value, label]) => (
                      <option key={value} value={value} data-account={value}>
                        {tr(label)}
                      </option>
                    ))}
                  </FormSelect>
                )}
              </Field>
              <Field label={tr('账户名称')}>
                {control => (
                  <Input
                    {...control}
                    name="name"
                    defaultValue={selected?.name}
                    maxLength={80}
                    required
                    placeholder={tr('例如：工资卡、日常微信、备用支付宝')}
                  />
                )}
              </Field>
              <div className={shared.grid}>
                <Field label={tr('持有人 / 账号备注')}>
                  {control => (
                    <Input
                      {...control}
                      name="holder"
                      defaultValue={selected?.holder}
                      maxLength={60}
                      placeholder={tr('例如：自己、家人、工作号')}
                    />
                  )}
                </Field>
                <Field label={tr('银行 / 机构')}>
                  {control => (
                    <Input
                      {...control}
                      name="institution"
                      defaultValue={selected?.institution}
                      maxLength={60}
                      placeholder={tr('例如：招商银行')}
                    />
                  )}
                </Field>
                <Field label={tr('卡号 / 手机号尾号')}>
                  {control => (
                    <Input
                      {...control}
                      name="suffix"
                      defaultValue={selected?.suffix}
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      placeholder={tr('选填，4位数字')}
                    />
                  )}
                </Field>
              </div>
              <Field label={tr('开始记账前的余额（元）')}>
                {control => (
                  <Input
                    {...control}
                    name="opening"
                    className={shared.numeric}
                    inputMode="decimal"
                    defaultValue={selected ? selected.opening / 100 : '0'}
                    required
                  />
                )}
              </Field>

              <Button variant="primary" type="submit" disabled={busy}>
                {tr('保存账户')}
              </Button>
            </form>
          ) : mode === 'reconcile' ? (
            <form
              className={shared.form}
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const balance = signedCents(String(f.get('balance')));
                  setConfirmation({
                    label: tr('确认校准余额'),
                    detail: accountLabel(selected!) + ' · ' + yuan(selected!.balance) + ' → ' + yuan(balance),
                    action: () =>
                      submit({
                        operation: 'reconcile',
                        id: selected!.id,
                        version: selected!.version,
                        expectedBalance: selected!.balance,
                        balance,
                        note: String(f.get('note')),
                        effectiveDate: String(f.get('effectiveDate')),
                      }),
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p>
                {tr('账面余额：')}
                <strong>{yuan(selected!.balance)}</strong>
              </p>
              <Field label={tr('目前实际余额（元）')}>
                {control => (
                  <Input
                    {...control}
                    name="balance"
                    className={shared.numeric}
                    inputMode="decimal"
                    defaultValue={selected!.balance / 100}
                    required
                  />
                )}
              </Field>
              <Field label={tr('生效日期')}>
                {control => (
                  <Input
                    {...control}
                    type="date"
                    name="effectiveDate"
                    max={recordingDate()}
                    defaultValue={recordingDate()}
                    required
                  />
                )}
              </Field>
              <Field label={tr('调整原因')}>
                {control => (
                  <Input
                    {...control}
                    name="note"
                    maxLength={500}
                    required
                    placeholder={tr('例如：核对银行余额，补齐早期差额')}
                  />
                )}
              </Field>

              <Button variant="primary" type="submit" disabled={busy}>
                {tr('确认校准余额')}
              </Button>
            </form>
          ) : (
            selected && (
              <>
                <div className={styles.detailAmount}>
                  <small>{tr('当前余额')}</small>
                  <strong>{yuan(selected.balance)}</strong>
                </div>
                <ListRow title={tr('期初余额')} end={yuan(selected.opening)} />
                <ListRow title={tr('账户状态')} end={selected.archived ? tr('已归档') : tr('使用中')} />
                {canWrite && (
                  <div className={shared.actions}>
                    <Button variant="primary" onClick={() => setMode('edit')}>
                      {tr('修改账户')}
                    </Button>
                    <Button variant="secondary" onClick={() => setMode('reconcile')}>
                      {tr('核对余额')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setMergeTarget('');
                        setMergeBalance('');
                        setMode('merge');
                      }}
                    >
                      {tr('合并钱包')}
                    </Button>

                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          label: selected.archived ? tr('恢复使用') : tr('归档账户'),
                          detail: accountLabel(selected),
                          action: () =>
                            submit({
                              operation: 'archive',
                              id: selected.id,
                              version: selected.version,
                              archived: !selected.archived,
                            }),
                        })
                      }
                    >
                      {selected.archived ? <RotateCcw size={17} /> : <Archive size={17} />}{' '}
                      {selected.archived ? tr('恢复使用') : tr('归档账户')}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          label: tr('确认删除钱包'),
                          detail:
                            accountLabel(selected) +
                            ' · ' +
                            yuan(selected.balance) +
                            ' · ' +
                            tr('删除钱包后，该钱包的余额将从资产总额中移除。') +
                            ' ' +
                            tr(
                              '有历史流水、余额校准或周期计划的钱包，请先合并到其他钱包；也可以归档保留历史。',
                            ),
                          action: () =>
                            submit({
                              operation: 'delete',
                              id: selected.id,
                              version: selected.version,
                              expectedBalance: selected.balance,
                            }),
                        })
                      }
                    >
                      {tr('删除钱包')}
                    </Button>
                  </div>
                )}
                <WalletPeriod
                  key={selected.id + month}
                  account={selected}
                  book={book}
                  books={books}
                  month={month}
                  revision={allAccounts}
                  onChanged={async () => {
                    await reload();
                    await onChanged();
                  }}
                  onSelect={
                    onSelect &&
                    (row => {
                      setOpen(false);
                      onSelect(row);
                    })
                  }
                />
                <h3>{tr('最近的余额校准')}</h3>
                {history.length ? (
                  <PagedList items={history} resetKey={selected.id}>
                    {h => (
                      <div className={styles.adjustment} key={h.id}>
                        <strong>
                          {h.amount > 0 ? '+' : ''}
                          {yuan(h.amount)}
                        </strong>
                        <p>{h.note}</p>
                        <form
                          className={shared.form}
                          onSubmit={e => {
                            e.preventDefault();
                            const effectiveDate = String(new FormData(e.currentTarget).get('effectiveDate'));
                            setConfirmation({
                              label: tr('保存生效日期'),
                              detail: accountLabel(selected) + ' · ' + effectiveDate,
                              action: () =>
                                submit({
                                  operation: 'edit-adjustment',
                                  id: selected.id,
                                  version: selected.version,
                                  adjustmentId: h.id,
                                  effectiveDate,
                                }),
                            });
                          }}
                        >
                          <Field label={tr('生效日期')}>
                            {control => (
                              <Input
                                {...control}
                                type="date"
                                name="effectiveDate"
                                defaultValue={h.effective_date}
                                max={recordingDate()}
                                required
                              />
                            )}
                          </Field>
                          <Button variant="secondary" type="submit" disabled={busy}>
                            {tr('保存生效日期')}
                          </Button>
                        </form>
                        <small>
                          {new Date(h.created_at).toLocaleString(getLocale())} · {h.creator}
                        </small>
                      </div>
                    )}
                  </PagedList>
                ) : (
                  <p className={shared.muted}>{tr('暂无余额校准记录。')}</p>
                )}
              </>
            )
          )}
        </Sheet>
      )}
      {confirmation && (
        <ConfirmDialog
          open
          title={confirmation.label}
          confirmLabel={confirmation.label}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            confirmation.action();
          }}
        >
          {confirmation.detail}
        </ConfirmDialog>
      )}
    </>
  );
}

function WalletPeriod({
  account,
  book,
  books,
  month,
  revision,
  onChanged,
  onSelect,
}: {
  account: Account;
  book: string;
  books?: readonly { id: string }[];
  month: string;
  revision: unknown;
  onChanged: () => Promise<void>;
  onSelect?: (row: LedgerRow) => void;
}) {
  const { t: tr } = useI18n();
  const hasEntries = !!onSelect && !!book;
  const [range, setRange] = useState(() => monthRange(month));
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!hasEntries) return;
    const controller = new AbortController();
    setReport(null);
    setError('');
    const query = new URLSearchParams({
      ...range,
      account: account.id,
      basis: 'cashflow',
      offset: String(offset),
      limit: '20',
    });
    books?.forEach(b => query.append('book', b.id));
    fetch('/api/books/' + book + '/report?' + query, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!controller.signal.aborted) setReport(data);
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [range, offset, account.id, book, books, revision, hasEntries]);
  return (
    <section>
      <ReportPeriodPicker
        value={range}
        onChange={value => {
          setRange(value);
          setOffset(0);
        }}
      />
      <WalletFundsPanel
        {...range}
        owner={account.family_id || 'personal'}
        walletId={account.id}
        revision={revision}
        onChanged={onChanged}
      />
      {hasEntries && onSelect && (
        <>
          <h3>{tr('账本流水')}</h3>
          {error && <p role="alert">{tr(error)}</p>}
          {report &&
            (report.rows.length ? (
              <TransactionList rows={report.rows} onSelect={onSelect} showBook />
            ) : (
              <EmptyState title={tr('没有匹配的资金流水')} />
            ))}
          {report && (offset > 0 || offset + 20 < report.totals.count) && (
            <div className={styles.actions}>
              <Button variant="primary" disabled={!offset} onClick={() => setOffset(offset - 20)}>
                {tr('上一页')}
              </Button>
              <Button
                variant="primary"
                disabled={offset + 20 >= report.totals.count}
                onClick={() => setOffset(offset + 20)}
              >
                {tr('下一页')}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
