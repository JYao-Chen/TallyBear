'use client';
import { Button, Card, Field, Input, Select, Sheet, Money, ListRow, ConfirmDialog, EmptyState } from '@/ui';
import styles from './SchedulesPanel.module.css';
import shared from './WorkspacePlans.module.css';
import { PagedList } from './PagedList';

import { DateField } from './DateField';
import { useI18n } from './LanguageProvider';

import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import { VisualSelect } from './VisualSelect';
import { useState } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import { amountToCents } from '@/server/model';
import type { Draft } from './DraftReview';
export type Schedule = {
  id: string;
  name: string;
  value: Draft;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval_count: number;
  next_date: string;
  paused: boolean;
  version: number;
  interval_months: number;
  amortize: boolean;
};
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
export function SchedulesPanel({
  items,
  accounts,
  categories,
  canWrite,
  onChange,
}: {
  items: Schedule[];
  accounts: (AccountIdentity & { id: string })[];
  categories: { name: string; archived: boolean }[];
  canWrite: boolean;
  onChange: (body: unknown) => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [selected, setSelected] = useState<Schedule | null>(null),
    [mode, setMode] = useState<'edit' | 'confirm' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(body: unknown) {
    setBusy(true);
    setError('');
    try {
      await onChange(body);
      setMode(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(s: Schedule | null, view: 'edit' | 'confirm') {
    setSelected(s);
    setFrequency(s?.frequency || 'monthly');
    setMode(view);
    setError('');
  }
  return (
    <Card className={shared.panel}>
      <div className={shared.heading}>
        <h2>
          <CalendarDays size={22} />
          {tr('我的周期账单')}
        </h2>
        {canWrite && (
          <Button variant="ghost" onClick={() => open(null, 'edit')}>
            <Plus size={18} />
            {tr('新增')}
          </Button>
        )}
      </div>

      {error && !mode && <p className={shared.error}>{tr(error)}</p>}
      {!items.length && <EmptyState title={tr('还没有周期账单，先添加一项固定开销吧。')} />}
      {
        <PagedList items={items}>
          {s => (
            <article className={styles.scheduleCard} key={s.id}>
              <ListRow
                title={s.name}
                meta={
                  <>
                    {s.next_date} ·{' '}
                    {tr('每 {0} {1}', [
                      s.interval_count || 1,
                      locale === 'en'
                        ? { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[s.frequency] +
                          ((s.interval_count || 1) === 1 ? '' : 's')
                        : tr({ daily: '天', weekly: '周', monthly: '个月', yearly: '年' }[s.frequency]),
                    ])}
                    {s.amortize ? tr(' · 按月分摊') : ''} ·{' '}
                    {s.paused ? tr('已暂停') : s.next_date <= today() ? tr('已到期，待核对') : tr('未到期')}
                  </>
                }
                end={
                  <Money
                    value={s.value.amount}
                    tone={
                      s.value.kind === 'expense' ? 'expense' : s.value.kind === 'income' ? 'income' : 'plain'
                    }
                  />
                }
              />
              {canWrite && (
                <div className={shared.actions}>
                  <Button variant="ghost" disabled={busy} onClick={() => open(s, 'edit')}>
                    {tr('管理')}
                  </Button>
                  {!s.paused && s.next_date <= today() && (
                    <Button variant="primary" disabled={busy} onClick={() => open(s, 'confirm')}>
                      {tr('核对本期')}
                    </Button>
                  )}
                </div>
              )}
            </article>
          )}
        </PagedList>
      }
      {mode && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={mode === 'confirm' ? tr('核对本期账单') : selected ? tr('管理周期账单') : tr('新增周期账单')}
          onClose={() => {
            if (!busy) setMode(null);
          }}
        >
          {error && (
            <p className={shared.error} role="alert">
              {tr(error)}
            </p>
          )}
          {mode === 'confirm' && selected ? (
            <form
              className={shared.form}
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  run({
                    operation: 'confirm',
                    id: selected.id,
                    version: selected.version,
                    dueDate: selected.next_date,
                    paidDate: String(f.get('date')),
                    startMonth: String(f.get('startMonth') || String(f.get('date')).slice(0, 7)),
                    startDate: String(f.get('startDate') || String(f.get('date'))),
                    amount: amountToCents(String(f.get('amount'))),
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <h3>{selected.name}</h3>
              <p className={shared.muted}>
                {tr('本期应付日期')}
                {selected.next_date}
                {tr('。确认后只记录本期，下一期按原周期计算。')}
              </p>
              <Field label={tr('实际金额（元）')}>
                {control => (
                  <Input
                    {...control}
                    name="amount"
                    className={shared.numeric}
                    inputMode="decimal"
                    defaultValue={selected.value.amount / 100}
                    required
                  />
                )}
              </Field>
              {selected.amortize && (
                <label>
                  {tr('分摊开始')}
                  {selected.frequency === 'daily' || selected.frequency === 'weekly' ? (
                    <DateField name="startDate" type="date" defaultValue={today()} required />
                  ) : (
                    <DateField name="startMonth" type="month" defaultValue={today().slice(0, 7)} required />
                  )}
                  <small>
                    {tr('覆盖')}
                    {selected.interval_count} $
                    {{ daily: '天', weekly: '周', monthly: '个月', yearly: '年' }[selected.frequency]}
                  </small>
                </label>
              )}
              <label>
                {tr('实际收付款日期')}
                <DateField name="date" type="date" defaultValue={today()} required />
              </label>
              <div className={shared.actions}>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run({
                      operation: 'skip',
                      id: selected.id,
                      version: selected.version,
                      dueDate: selected.next_date,
                    })
                  }
                >
                  {tr('本期不记，跳过')}
                </Button>
                <Button variant="primary" type="submit" disabled={busy}>
                  {tr('确认本期已收付')}
                </Button>
              </div>
            </form>
          ) : (
            <form
              className={shared.form}
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  run({
                    operation: 'save',
                    id: selected?.id,
                    version: selected?.version,
                    name: String(f.get('name')),
                    frequency: String(f.get('frequency')),
                    intervalCount: Number(f.get('intervalCount') || 1),
                    amortize: f.get('amortize') === 'on',
                    nextDate: String(f.get('nextDate')),
                    value: {
                      kind: String(f.get('kind')),
                      amount: amountToCents(String(f.get('amount'))),
                      accountId: String(f.get('account')),
                      payee: String(f.get('payee')),
                      category: String(f.get('category')),
                      note: String(f.get('note')),
                    },
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label={tr('账单名称')}>
                {control => (
                  <Input
                    {...control}
                    name="name"
                    defaultValue={selected?.name}
                    maxLength={80}
                    required
                    placeholder={tr('例如：房租、视频会员')}
                  />
                )}
              </Field>
              <div className={shared.grid}>
                <Field label={tr('类型')}>
                  {control => (
                    <Select {...control} name="kind" defaultValue={selected?.value.kind}>
                      <option value="expense">{tr('支出')}</option>
                      <option value="income">{tr('收入')}</option>
                    </Select>
                  )}
                </Field>
                <Field label={tr('预计金额（元）')}>
                  {control => (
                    <Input
                      {...control}
                      name="amount"
                      className={shared.numeric}
                      inputMode="decimal"
                      defaultValue={selected ? selected.value.amount / 100 : ''}
                      required
                    />
                  )}
                </Field>
                <Field label={tr('重复周期')}>
                  {control => (
                    <Select
                      {...control}
                      name="frequency"
                      value={frequency}
                      onChange={e => setFrequency(e.target.value)}
                    >
                      <option value="daily">{tr('天')}</option>
                      <option value="weekly">{tr('周')}</option>
                      <option value="monthly">{tr('月')}</option>
                      <option value="yearly">{tr('年')}</option>
                    </Select>
                  )}
                </Field>
                <Field label={tr('周期数量')}>
                  {control => (
                    <Input
                      {...control}
                      name="intervalCount"
                      type="number"
                      min={1}
                      defaultValue={selected?.interval_count || 1}
                      required
                    />
                  )}
                </Field>
                <label>
                  {tr('下一次日期')}
                  <DateField
                    name="nextDate"
                    type="date"
                    defaultValue={selected?.next_date || today()}
                    required
                  />
                </label>
                <label>
                  {tr('资金账户')}
                  <VisualSelect
                    name="account"
                    defaultValue={selected?.value.accountId}
                    label={tr('资金账户')}
                    options={accounts.map(a => ({
                      value: a.id,
                      label: accountLabel(a),
                      account: true,
                      accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                    }))}
                  />
                </label>
                <label>
                  {tr('分类')}
                  <VisualSelect
                    name="category"
                    defaultValue={selected?.value.category}
                    label={tr('分类')}
                    options={categories.filter(c => !c.archived).map(c => ({ value: c.name, label: c.name }))}
                  />
                </label>
              </div>
              <label className={styles.allocationToggle}>
                <input type="checkbox" name="amortize" defaultChecked={selected?.amortize} />
                {tr('付款后按覆盖周期分摊')}
              </label>

              <Field label={tr('商家 / 交易对方')}>
                {control => (
                  <Input {...control} name="payee" defaultValue={selected?.value.payee} maxLength={120} />
                )}
              </Field>
              <Field label={tr('备注')}>
                {control => (
                  <Input {...control} name="note" defaultValue={selected?.value.note} maxLength={2000} />
                )}
              </Field>

              <div className={shared.actions}>
                {selected && (
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run({
                        operation: 'pause',
                        id: selected.id,
                        version: selected.version,
                        paused: !selected.paused,
                      })
                    }
                  >
                    {selected.paused ? tr('恢复计划') : tr('暂停计划')}
                  </Button>
                )}
                <Button variant="primary" type="submit" disabled={busy}>
                  {tr('保存计划')}
                </Button>
              </div>
              {selected && (
                <Button variant="ghost" type="button" disabled={busy} onClick={() => setDeleting(true)}>
                  {tr('删除计划（已入账记录保留）')}
                </Button>
              )}
            </form>
          )}
          {deleting && selected && (
            <ConfirmDialog
              open
              title={tr('删除计划（已入账记录保留）')}
              onCancel={() => setDeleting(false)}
              onConfirm={() => {
                setDeleting(false);
                void run({ operation: 'delete', id: selected.id, version: selected.version });
              }}
            >
              {selected.name}
            </ConfirmDialog>
          )}
        </Sheet>
      )}
    </Card>
  );
}
