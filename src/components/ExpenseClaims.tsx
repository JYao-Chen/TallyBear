'use client';
import { participantAvatar } from '@/ui/participantAvatar';
import { Button, Card, Chip, ConfirmDialog, Field, Input, ListRow, Money, Sheet, TextArea } from '@/ui';
import s from './ExpenseClaims.module.css';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LedgerEntryContent } from './LedgerEntryDetail';
import { ReceiptAttachments } from './ReceiptAttachments';
import { useEntryDetail } from './EntryDetailContext';
import { Inbox } from 'lucide-react';
import { Avatar } from './ManagementPages';
import { VisualSelect } from './VisualSelect';
import { ClaimRecipientSelect } from './ClaimRecipientSelect';
import { Discussion } from './Discussion';
import { useI18n } from './LanguageProvider';
import { formatMoney } from '@/lib/deployment';
export async function claimRequest(path: string, body?: unknown, signal?: AbortSignal) {
  const r = await fetch('/api/expense-claims/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Request failed');
  return d;
}
export function ExpenseClaimDetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t: tr, locale } = useI18n();
  const [confirmation, setConfirmation] = useState<'cancel' | 'withdraw' | null>(null);
  const openEntry = useEntryDetail();
  const [editingRecord, setEditingRecord] = useState<{
    title: string;
    category: string;
    note: string;
  } | null>(null);
  const [data, setData] = useState<any>(null),
    [book, setBook] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const d = await claimRequest(id);
    setData(d);
    setBook(d.targetBookId || '');
    setError('');
    await claimRequest(id, { operation: 'read', version: d.claim.version });
    window.dispatchEvent(new Event('expense-claims-changed'));
  }, [id]);
  useEffect(() => {
    void load().catch(e => setError(e.message));
  }, [load]);
  async function act(operation: string) {
    setBusy(true);
    setError('');
    try {
      await claimRequest(id, { operation, version: data.claim.version, bookId: book || undefined });
      setConfirmation(null);
      await load();
      onChanged();
      window.dispatchEvent(new Event('expense-claims-changed'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const c = data?.claim,
    recipient = c?.recipient_id === data?.userId,
    active = c && ['pending', 'accepted'].includes(c.status),
    person = (id: string) => data.people.find((p: any) => p.id === id);
  if (editingRecord)
    return (
      <Sheet
        open
        closeLabel={tr('关闭弹窗')}
        title={tr(locale === 'en' ? 'Edit record' : '修改记录')}
        onClose={() => {
          if (!busy) setEditingRecord(null);
        }}
      >
        <p className={s.muted}>
          {tr('修改你账单中的标题、分类和备注；实际付款金额、日期和钱包由付款人维护。')}
        </p>
        <form
          onSubmit={async e => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await claimRequest(id, {
                operation: 'edit-record',
                version: c.version,
                recordVersion: data.ownRecord.version,
                ...editingRecord,
              });
              setEditingRecord(null);
              await load();
              onChanged();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={tr(locale === 'en' ? 'Title' : '账目标题')}>
            {control => (
              <Input
                {...control}
                value={editingRecord.title}
                maxLength={200}
                onChange={e => setEditingRecord({ ...editingRecord, title: e.target.value })}
              />
            )}
          </Field>
          <Field label={tr('分类')}>
            {control => (
              <Input
                {...control}
                value={editingRecord.category}
                required
                maxLength={60}
                onChange={e => setEditingRecord({ ...editingRecord, category: e.target.value })}
              />
            )}
          </Field>
          <Field label={tr(locale === 'en' ? 'Note' : '备注')}>
            {control => (
              <TextArea
                {...control}
                aria-label={tr(locale === 'en' ? 'Note' : '备注')}
                value={editingRecord.note}
                maxLength={2000}
                onChange={e => setEditingRecord({ ...editingRecord, note: e.target.value })}
              />
            )}
          </Field>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <div className={s.actions}>
            <Button type="submit" variant="primary" disabled={busy}>
              {tr('保存修改')}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditingRecord(null)}>
              {tr(locale === 'en' ? 'Cancel changes' : '取消修改')}
            </Button>
          </div>
        </form>
      </Sheet>
    );
  return (
    <Sheet
      open
      closeLabel={tr('关闭弹窗')}
      title={tr('账单认领')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Button variant="ghost" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>
        {tr('刷新账单')}
      </Button>
      {!data && !error && <p role="status">{tr('正在读取…')}</p>}
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      {data && (
        <>
          <div className={s.person}>
            <Avatar value={participantAvatar(person(c.sender_id)?.avatar)} size={40} />
            <div>
              <strong>{tr('{0}为{1}购买', [person(c.sender_id)?.name, person(c.recipient_id)?.name])}</strong>
              <Chip
                tone={c.status === 'pending' ? 'attention' : c.status === 'accepted' ? 'income' : 'neutral'}
              >
                {
                  (
                    {
                      pending: tr('待认领'),
                      accepted: tr('已认领'),
                      declined: tr('已拒绝'),
                      withdrawn: tr('已撤回或取消'),
                    } as Record<string, string>
                  )[c.status]
                }
              </Chip>
            </div>
          </div>
          <LedgerEntryContent
            discussion={<Discussion key={id} target={{ kind: 'claim', id }} />}
            row={{
              ...data.source,
              ...(recipient && data.ownRecord
                ? {
                    title: data.ownRecord.title,
                    category: data.ownRecord.category,
                    note: data.ownRecord.note,
                  }
                : {}),
            }}
            detailBook={recipient ? data.books.find((b: any) => b.id === data.targetBookId) : data.sourceBook}
            attachments={
              <ReceiptAttachments
                book={data.source.book_id || ''}
                transaction={data.source.id || ''}
                claimId={id}
                showEmpty
                allowRecognize={false}
                canWrite={!!data.canEditSource}
              />
            }
          />
          {data.source.refunded > 0 && (
            <p>
              {tr('已到账退款')} {formatMoney(data.source.refunded)} · {tr('净消费')}{' '}
              {formatMoney(data.source.amount - data.source.refunded)}
            </p>
          )}
          {(data.canEditSource || data.canEditOwn) && (
            <div className={s.actions}>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (data.canEditSource) {
                    onClose();
                    openEntry?.(data.source, { edit: true });
                  } else
                    setEditingRecord({
                      title: data.ownRecord.title || '',
                      category: data.ownRecord.category,
                      note: data.ownRecord.note || '',
                    });
                }}
              >
                {tr(locale === 'en' ? 'Edit record' : '修改记录')}
              </Button>
            </div>
          )}
          <p className={s.muted}>
            {tr(
              '认领后，消费只归入所选账本，原付款人仍可从“为他人购买”查看单据和讨论。不表示欠款，也不会从认领人的钱包扣款。',
            )}
          </p>
          {recipient && active && (
            <>
              <label>
                {tr('归入我的哪个账本')}
                <VisualSelect
                  label={tr('认领账本')}
                  value={book}
                  onChange={setBook}
                  disabled={busy}
                  options={[
                    { value: '', label: tr('请选择账本') },
                    ...data.books.map((b: any) => ({
                      value: b.id,
                      label: b.name + ' · ' + (b.kind === 'shared' ? tr('公账') : tr('私账')),
                      icon: b.icon,
                    })),
                  ]}
                />
              </label>
              <p className={s.muted}>
                {tr('选择公账后，该账本成员可查看这笔记录；对方不会获得你的私账权限。')}
              </p>
              <div className={s.actions}>
                <Button
                  disabled={busy || !book || (c.status === 'accepted' && book === data.targetBookId)}
                  onClick={() => void act('accept')}
                >
                  {c.status === 'pending' ? tr('确认认领') : tr('调整归入账本')}
                </Button>
                {c.status === 'pending' ? (
                  <Button variant="secondary" disabled={busy} onClick={() => void act('decline')}>
                    {tr('拒绝认领')}
                  </Button>
                ) : (
                  <Button variant="ghost" disabled={busy} onClick={() => setConfirmation('cancel')}>
                    {tr('取消认领')}
                  </Button>
                )}
              </div>
            </>
          )}
          {!recipient && active && (
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmation('withdraw')}>
              {tr('撤回认领邀请')}
            </Button>
          )}
        </>
      )}
      {confirmation && (
        <ConfirmDialog
          open
          busy={busy}
          title={confirmation === 'cancel' ? tr('取消认领') : tr('撤回认领邀请')}
          onCancel={() => {
            if (!busy) setConfirmation(null);
          }}
          onConfirm={() => void act(confirmation)}
        >
          <p>
            {confirmation === 'cancel'
              ? tr('取消认领并移除由认领添加的账本关联？')
              : tr('撤回邀请及由认领添加的账本关联，并通知对方？')}
          </p>
          {error && (
            <p role="alert" className={s.error}>
              {tr(error)}
            </p>
          )}
        </ConfirmDialog>
      )}
    </Sheet>
  );
}
export function ExpenseClaimsInbox({
  revision,
  onChanged,
  onCount,
  compact = false,
  limit,
}: {
  revision: number;
  onChanged: () => void;
  onCount?: (count: number) => void;
  compact?: boolean;
  limit?: number;
}) {
  const { t: tr } = useI18n();
  const [data, setData] = useState<any>(null),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(''),
    [selected, setSelected] = useState('');
  useEffect(() => {
    onCount?.(error ? -1 : data?.total || 0);
  }, [data?.total, error, onCount]);
  const load = useCallback(async () => {
    const d = await claimRequest('inbox?offset=' + offset);
    if (!d.rows.length && offset) {
      setOffset(0);
      return;
    }
    setData(d);
    setError('');
  }, [offset]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (live && document.visibilityState === 'visible')
        void load().catch(e => {
          if (live) setError(e.message);
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('expense-claims-changed', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('expense-claims-changed', refresh);
    };
  }, [revision, load]);
  const Group = compact ? 'div' : Card;
  const events: Record<string, string> = {
    membership_removed: tr('家庭关系已变化，认领已撤回'),
    invited: tr('邀请你认领'),
    accepted: tr('已认领账单'),
    source_changed: tr('原账单有修改，请核对'),
    source_deleted: tr('原账单已删除，认领已撤回'),
    withdrawn: tr('已撤回认领邀请'),
    cancel: tr('已取消认领'),
    decline: tr('已拒绝认领'),
  };
  return (
    <>
      {(!!data?.total || !!error) && (
        <Group className={compact ? undefined : s.inbox} hidden={limit === 0 && !error}>
          {!compact && (
            <div className={s.heading}>
              <h2>
                <Inbox size={22} />
                {tr('待认领与账单动态')} <Chip tone="attention">{data?.total || 0}</Chip>
              </h2>
              <Button variant="ghost" onClick={() => void load().catch(e => setError(e.message))}>
                {tr('刷新')}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
          {data?.rows.slice(0, limit).map((r: any) => (
            <ListRow
              key={r.id}
              className={s.claimRow}
              leading={<Avatar value={participantAvatar(r.avatar)} size={32} />}
              title={r.title || r.product || r.payee || tr('消费账单')}
              meta={
                <>
                  {r.name} · {r.date}
                  <br />
                  <Chip tone={r.status === 'pending' ? 'attention' : 'neutral'}>
                    {events[r.event] || (r.status === 'pending' ? tr('待你认领') : tr('账单动态'))}
                  </Chip>
                </>
              }
              end={<Money value={r.amount} />}
              endMeta={
                <Button variant="ghost" onClick={() => setSelected(r.id)}>
                  {r.status === 'pending' && r.side === 'recipient' ? tr('查看并认领') : tr('查看动态')}
                </Button>
              }
            />
          ))}
          {limit === undefined && data?.total > 5 && (
            <div className={s.actions}>
              <Button variant="secondary" disabled={!offset} onClick={() => setOffset(v => v - 5)}>
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
      {/* Reading the last update or accepting the last invite can hide the inbox. */}
      {selected &&
        createPortal(
          <ExpenseClaimDetail
            id={selected}
            onClose={() => setSelected('')}
            onChanged={() => {
              onChanged();
              void load().catch(e => setError(e.message));
            }}
          />,
          document.body,
        )}
    </>
  );
}
export function ExpenseClaimsSent({
  revision,
  onChanged,
  onCount,
  compact = false,
}: {
  revision: number;
  onChanged: () => void;
  onCount?: (count: number) => void;
  compact?: boolean;
}) {
  const { t: tr } = useI18n();
  const [data, setData] = useState<any>(null),
    [offset, setOffset] = useState(0),
    [expanded, setExpanded] = useState(compact),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    onCount?.(error ? -1 : data?.total || 0);
  }, [data?.total, error, onCount]);
  const load = useCallback(async () => {
    const d = await claimRequest('sent?offset=' + offset);
    if (!d.rows.length && offset) {
      setOffset(0);
      return;
    }
    setData(d);
    setError('');
  }, [offset]);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (!controller.signal.aborted)
        void load().catch(e => {
          if (!controller.signal.aborted) setError(e.message);
        });
    };
    refresh();
    window.addEventListener('expense-claims-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('expense-claims-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [revision, load]);
  const labels: Record<string, string> = {
    pending: tr('待对方认领'),
    accepted: tr('已转入对方选择的账本'),
    declined: tr('对方已拒绝'),
    withdrawn: tr('已撤回或取消'),
  };
  return (
    <>
      {(!!data?.total || !!error) && (
        <Card>
          <div className={s.heading}>
            <h2>
              {tr('为他人购买')} <small>{data?.total || ''}</small>
            </h2>
            <Button
              type="button"
              variant="ghost"
              aria-expanded={expanded}
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? tr('收起记录') : tr('查看记录')}
            </Button>
          </div>
          <p className={s.muted}>
            {tr('认领后消费归入对方选择的账本；这里保留你实际付款的单据与讨论，已读后仍可查看。')}
          </p>
          {error && (
            <p role="alert" className={s.error}>
              {error}
              <Button
                type="button"
                variant="ghost"
                onClick={() => void load().catch(e => setError(e.message))}
              >
                {tr('重试')}
              </Button>
            </p>
          )}
          {expanded && (
            <>
              {data?.rows.map((r: any) => (
                <ListRow
                  key={r.id}
                  className={s.claimRow}
                  leading={<Avatar value={participantAvatar(r.avatar)} size={32} />}
                  title={r.title}
                  meta={
                    <>
                      {tr('为{0}购买', [r.name])} · {r.date}
                      <br />
                      <Chip tone={r.status === 'pending' ? 'attention' : 'neutral'}>{labels[r.status]}</Chip>
                    </>
                  }
                  end={<Money value={r.amount} />}
                  endMeta={
                    <Button variant="ghost" onClick={() => setSelected(r.id)}>
                      {tr('查看单据与讨论')}
                    </Button>
                  }
                />
              ))}
              {data?.total > 5 && (
                <div className={s.actions}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!offset}
                    onClick={() => setOffset(v => v - 5)}
                  >
                    {tr('上一页')}
                  </Button>
                  <span>
                    {offset + 1}–{Math.min(offset + 5, data.total)} / {data.total}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={offset + 5 >= data.total}
                    onClick={() => setOffset(v => v + 5)}
                  >
                    {tr('下一页')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
      {selected && (
        <ExpenseClaimDetail
          id={selected}
          onClose={() => setSelected('')}
          onChanged={() => {
            onChanged();
            void load().catch(e => setError(e.message));
          }}
        />
      )}
    </>
  );
}
export function ExpenseClaimRecord({
  transactionId,
  onChanged,
  onPermission,
}: {
  transactionId: string;
  onChanged?: () => void;
  onPermission?: (canEdit: boolean) => void;
}) {
  const { t: tr } = useI18n();
  const [data, setData] = useState<any>(null),
    [recipient, setRecipient] = useState(''),
    [selfBook, setSelfBook] = useState(''),
    [open, setOpen] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const d = await claimRequest('for-record?id=' + transactionId);
    setData(d);
    setRecipient(d.claim?.recipient_id || '');
    setSelfBook(d.selfBooks?.length === 1 ? d.selfBooks[0].id : '');
    onPermission?.(d.canEdit);
  }, [transactionId]);
  useEffect(() => {
    void load().catch(e => setError(e.message));
  }, [load]);
  const chooseBook = data?.selfBooks && recipient === data.userId;
  return (
    <section className={s.record}>
      {data?.claim && (
        <>
          <p>
            {tr('认领对象')}：{data.claim.recipient_name} · {data.familyId ? tr('发起人') : tr('实际付款人')}
            ：{data.claim.sender_name} ·{' '}
            <Chip tone={data.claim.status === 'accepted' ? 'income' : 'attention'}>
              {data.claim.status === 'accepted' ? tr('已认领') : tr('待认领')}
            </Chip>
          </p>
          {data.canOpen && (
            <Button variant="secondary" onClick={() => setOpen(data.claim.id)}>
              {tr('查看认领与讨论')}
            </Button>
          )}
        </>
      )}
      {data?.canInvite && (!data.claim || data.claim.status === 'pending') && (
        <>
          <ClaimRecipientSelect
            familyId={data.familyId}
            value={recipient}
            onChange={setRecipient}
            disabled={busy}
          />
          {chooseBook && (
            <VisualSelect
              label={tr('归入我的哪个账本')}
              value={selfBook}
              onChange={setSelfBook}
              disabled={busy}
              options={[
                { value: '', label: tr('请选择账本') },
                ...data.selfBooks.map((b: { id: string; name: string }) => ({ value: b.id, label: b.name })),
              ]}
            />
          )}
          <Button
            variant="secondary"
            disabled={busy || (chooseBook && !selfBook) || recipient === (data.claim?.recipient_id || '')}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await claimRequest('invite', {
                  sourceId: transactionId,
                  recipientId: recipient || null,
                  bookId: chooseBook ? selfBook : undefined,
                });
                await load();
                onChanged?.();
                window.dispatchEvent(new Event('expense-claims-changed'));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {data.familyId ? tr('指给家庭成员') : tr('保存消费对象')}
          </Button>
        </>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {open && (
        <ExpenseClaimDetail
          id={open}
          onClose={() => setOpen('')}
          onChanged={() => {
            void load().catch(e => setError(e.message));
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
