'use client';
import { Button, Card, Chip, Field, IconButton, ListRow, Money, Sheet, TextArea } from '@/ui';
import s from './HomeFamilyInbox.module.css';
import { useI18n } from './LanguageProvider';
import { useEffect, useState, useCallback } from 'react';
import { Inbox, Check, RefreshCw } from 'lucide-react';
import { VisualSelect } from './VisualSelect';

import Link from 'next/link';
import { pathForPage } from '@/lib/routes';
import { ExpenseClaimsInbox } from './ExpenseClaims';
async function request(path: string, body?: unknown) {
  const r = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d;
}
export function HomeFamilyInbox({
  revision,
  compact = true,
  onChanged,
}: {
  compact?: boolean;
  revision: number;
  onChanged: () => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const [data, setData] = useState<any>({ rows: [], total: 0 }),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<any>(null),
    [options, setOptions] = useState<any>(null),
    [target, setTarget] = useState(''),
    [book, setBook] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [refreshes, setRefreshes] = useState(0);
  const [claims, setClaims] = useState(0);
  const [reply, setReply] = useState('');
  const load = useCallback(async () => {
    const d = await request('family-inbox?offset=' + offset);
    if (!d.rows.length && offset) {
      setOffset(0);
      return;
    }
    setData(d);
    setError('');
  }, [offset]);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active && document.visibilityState === 'visible')
        load().catch(e => {
          if (active) setError(e.message);
        });
    };
    update();
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [load, revision, refreshes]);
  async function open(row: any) {
    setReply('');
    setSelected(row);
    setOptions(null);
    setTarget('');
    setError('');
    try {
      const d = await request('family-finance/' + row.family_id);
      setOptions(d);
      setBook(d.defaultBookId || '');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await request('family-finance/' + selected.family_id, {
        operation: 'confirm',
        id: selected.id,
        targetId: target,
        displayBookId: book || null,
        reply,
      });
      setSelected(null);
      await load();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const Group = compact ? 'div' : Card;
  return (
    <section
      aria-label={tr('家庭待办')}
      className={compact ? s.preview : s.tasks}
      hidden={!data.total && !claims && !error}
    >
      <header className={s.heading}>
        <h2>
          {tr('家庭待办')} <Chip tone="attention">{data.total + Math.max(0, claims)}</Chip>
        </h2>
        {compact && (
          <div className={s.links}>
            <IconButton label={tr('刷新')} onClick={() => setRefreshes(n => n + 1)}>
              <RefreshCw size={16} />
            </IconButton>
            <Link href={pathForPage('families')}>{tr('查看全部')}</Link>
          </div>
        )}
      </header>
      {(!!data.total || !!error) && (
        <Group className={compact ? undefined : s.inbox}>
          {!compact && (
            <header className={s.heading}>
              <h2>
                <Inbox size={18} />
                {tr('待收款 ')} <Chip tone="attention">{data.total}</Chip>
              </h2>
              <Button variant="ghost" onClick={() => load().catch(e => setError(e.message))}>
                {tr('刷新')}
              </Button>
            </header>
          )}
          {error && !selected && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          {data.rows.slice(0, compact ? 3 : undefined).map((r: any) => (
            <ListRow
              key={r.id}
              leading={<Inbox size={18} />}
              title={r.sender_name}
              meta={
                <>
                  {r.family_name} · {r.date}
                  {r.note && (
                    <>
                      <br />
                      {r.note}
                    </>
                  )}
                </>
              }
              end={<Money value={r.amount} tone="income" />}
              endMeta={
                <Button variant="ghost" onClick={() => open(r)}>
                  <Check size={16} />
                  {tr('收款')}
                </Button>
              }
            />
          ))}
          {!compact && data.total > 5 && (
            <div className={s.pagination}>
              <Button
                variant="secondary"
                disabled={!offset}
                onClick={() => setOffset(v => Math.max(0, v - 5))}
              >
                {tr('上一页')}
              </Button>
              <span>
                {offset + 1}–{Math.min(offset + 5, data.total)} / {data.total}
              </span>
              <Button
                variant="secondary"
                disabled={offset + 5 >= data.total}
                onClick={() => setOffset(v => v + 5)}
              >
                {tr('下一页')}
              </Button>
            </div>
          )}
        </Group>
      )}
      <ExpenseClaimsInbox
        revision={revision + refreshes}
        onChanged={onChanged}
        compact={compact}
        onCount={setClaims}
        limit={compact ? Math.max(0, 3 - data.rows.length) : undefined}
      />
      {selected && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={tr('确认到账')}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>
            {selected.sender_name} · <Money value={selected.amount} tone="income" />
          </p>
          {options ? (
            <>
              <label>
                {tr('实际到账钱包')}
                <VisualSelect
                  label={tr('实际到账钱包')}
                  value={target}
                  onChange={setTarget}
                  options={[
                    { value: '', label: tr('请选择到账钱包') },
                    ...options.wallets
                      .filter((w: any) => w.owner_id === options.userId)
                      .map((w: any) => ({
                        value: w.id,
                        label: w.name + (w.suffix ? ' · ' + w.suffix : ''),
                        account: true,
                        accountName: w.institution || w.name,
                      })),
                  ]}
                />
              </label>
              <label>
                {tr('记入我的账本')}
                <VisualSelect
                  label={tr('记入我的账本')}
                  value={book}
                  onChange={setBook}
                  options={[
                    { value: '', label: tr('暂不展示在个人账本') },
                    ...options.books.map((b: any) => ({ value: b.id, label: b.name, icon: b.icon })),
                  ]}
                />
              </label>
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
              <Button disabled={busy || !target} onClick={confirm}>
                {busy ? tr('正在确认…') : tr('确认到账')}
              </Button>
            </>
          ) : (
            <p>{tr('正在读取我的钱包…')}</p>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
        </Sheet>
      )}
    </section>
  );
}
