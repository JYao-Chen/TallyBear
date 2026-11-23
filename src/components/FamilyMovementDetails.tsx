'use client';
import { SectionTabs } from './SectionTabs';
import { Discussion } from './Discussion';
import { TransactionBalance } from './TransactionBalance';
import { useI18n } from './LanguageProvider';
import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button, ConfirmDialog, Input, ListRow, Money, Sheet, TextArea } from '@/ui';
import s from './FamilyMovementDetails.module.css';
import detail from './LedgerEntryDetail.module.css';
import type { ReactNode } from 'react';
import { TransferIcon, VisualSelect } from './VisualSelect';
import type { LedgerRow } from '@/lib/ledger-types';
export function FamilyMovementDetails({
  row,
  onClose,
  onChanged,
  actions,
}: {
  row: Pick<
    LedgerRow,
    | 'id'
    | 'movement_family_id'
    | 'amount'
    | 'title'
    | 'account_name'
    | 'account_institution'
    | 'wallet_balances'
  >;
  actions?: ReactNode;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t: tr, locale } = useI18n();
  const [tab, setTab] = useState('overview');
  const [options, setOptions] = useState<any>(null),
    [movement, setMovement] = useState<any>(null),
    [book, setBook] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false);
  const [editingNote, setEditingNote] = useState(false),
    [sharedNote, setSharedNote] = useState('');
  const [correctingSource, setCorrectingSource] = useState(false),
    [sourceId, setSourceId] = useState(''),
    [sourceError, setSourceError] = useState('');
  const [confirm, setConfirm] = useState<'source' | 'edit' | null>(null);
  const [removeFile, setRemoveFile] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [form, setForm] = useState({
      title: '',
      note: '',
      transactionTime: '',
      platform: '',
      externalId: '',
    }),
    [files, setFiles] = useState<any[]>([]),
    [removed, setRemoved] = useState<string[]>([]);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/family-finance/' + row.movement_family_id, { signal: c.signal })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then(d => {
        const m = d.movements.find((m: any) => m.id === row.id);
        if (!m) throw Error(tr('往来记录不存在'));
        setOptions(d);
        setMovement(m);
        setTargetId(m.target_id || '');
        setSharedNote(m.note || '');
        setBook(m.displayBookId || '');
        setFiles(m.attachments || []);
        setForm({
          title: m.details?.title || row.title,
          note: m.details?.note || '',
          transactionTime: m.details?.transaction_time || '',
          platform: m.details?.platform ?? m.platform ?? '',
          externalId: m.details?.external_id ?? m.external_id ?? '',
        });
      })
      .catch(e => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [row.id, row.movement_family_id]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/family-finance/' + row.movement_family_id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'edit',
          id: row.id,
          displayBookId: book || null,
          ...form,
          removeAttachments: removed,
          ...(movement.recipient_id === options.userId &&
          movement.status === 'confirmed' &&
          targetId !== movement.target_id
            ? { targetId, expectedTargetId: movement.target_id }
            : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await onChanged();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSharedNote() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/family-finance/' + row.movement_family_id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'edit-note',
          id: row.id,
          note: sharedNote,
          expectedNote: movement.note || '',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMovement((m: any) => ({ ...m, note: d.note }));
      setSharedNote(d.note);
      setEditingNote(false);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function correctSource() {
    if (busy || !sourceId || sourceId === movement.source_id) return;
    setBusy(true);
    setSourceError('');
    try {
      const r = await fetch('/api/family-finance/' + row.movement_family_id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'correct-source',
          id: row.id,
          sourceId,
          expectedSourceId: movement.source_id,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await onChanged();
      onClose();
    } catch (e) {
      setSourceError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(images: File[], purpose: string) {
    setBusy(true);
    setError('');
    try {
      for (const image of images) {
        const r = await fetch(`/api/receipts?movement=${row.id}&purpose=${purpose}`, {
          method: 'POST',
          headers: { 'x-file-name': encodeURIComponent(image.name), 'Content-Type': image.type },
          body: image,
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setFiles(f => [...f, { id: d.data.split('/').at(-1), name: image.name, purpose }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    gift: tr('红包 / 赠与'),
    aa: tr('AA 结算'),
    loan: tr('借款'),
    repayment: tr('还款'),
    contribution: tr('共同入金'),
    transfer: tr('内部转账'),
  };
  const canEdit = movement && [movement.sender_id, movement.recipient_id].includes(options?.userId);
  const footer = (
    <div className={detail.actions}>
      {actions}
      {canEdit && (
        <Button
          disabled={busy}
          onClick={() => {
            if (
              editing &&
              movement.recipient_id === options.userId &&
              movement.status === 'confirmed' &&
              targetId !== movement.target_id
            )
              setConfirm('edit');
            else if (editing) void save();
            else {
              setEditing(true);
              setTab('record');
            }
          }}
        >
          {busy ? tr('处理中…') : editing ? tr('保存私人记录') : tr('修改私人记录')}
        </Button>
      )}
    </div>
  );
  const content = (
    <>
      <ConfirmDialog
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        title={tr('确认更改')}
        busy={busy}
        onConfirm={() => {
          setConfirm(null);
          if (confirm === 'source') void correctSource();
          else void save();
        }}
      >
        {confirm === 'source'
          ? tr(
              '确认更正这笔转账的付款钱包？已到账记录会重算两个付款钱包的余额，不会再次转账，收款方到账不变。',
            )
          : tr('确认更改这笔往来的到账钱包？')}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!removeFile}
        onCancel={() => setRemoveFile(null)}
        title={tr('移除图片')}
        onConfirm={() => {
          if (removeFile) setRemoved(old => [...old, removeFile]);
          setRemoveFile(null);
        }}
      >
        {tr('确认移除这张图片？')}
      </ConfirmDialog>
      {!movement && !error && <p role="status">{tr('正在读取往来详情…')}</p>}
      {movement && (
        <div className={detail.hero}>
          <small>
            {labels[movement?.kind as keyof typeof labels] || tr('家庭往来')} ·{' '}
            {movement?.status === 'confirmed'
              ? tr('已到账')
              : movement?.status === 'cancelled'
                ? tr('已取消')
                : tr('待收款')}
          </small>
          <Money size="large" value={row.amount} />
          <h3>
            <TransferIcon size={26} />
            {form.title || row.title}
          </h3>
        </div>
      )}
      {options && (
        <SectionTabs
          label={tr('往来详情分区')}
          value={tab}
          onChange={setTab}
          items={[
            {
              key: 'overview',
              label: tr('概览'),
              content: (
                <div className={s.stack}>
                  <div className={detail.fields}>
                    {[
                      [tr('交易日期'), movement.date],
                      [tr('交易时间'), form.transactionTime],
                      [tr('转出人'), movement.sender_name],
                      [tr('接收人'), movement.recipient_name || movement.target_name || tr('钱包转入')],
                      [tr('转出钱包'), movement.source_name || tr('对方个人钱包（不可见）')],
                      [
                        tr('到账钱包'),
                        movement.target_name ||
                          (movement.status === 'pending'
                            ? tr('等待收款人选择')
                            : movement.status === 'cancelled'
                              ? tr('未到账')
                              : tr('对方个人钱包（不可见）')),
                      ],
                      [tr('创建时间'), new Date(movement.created_at).toLocaleString(locale)],
                      [
                        tr('最后修改'),
                        new Date(
                          movement.details?.updated_at || movement.confirmed_at || movement.created_at,
                        ).toLocaleString(locale),
                      ],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <ListRow key={label} className={detail.field} title={label} end={value} />
                      ))}
                  </div>
                  <section className={s.section}>
                    <h3>{tr('转账留言 · 双方可见')}</h3>
                    {editingNote ? (
                      <>
                        <label>
                          {tr('转账留言 · 双方可见')}
                          <TextArea
                            value={sharedNote}
                            maxLength={500}
                            rows={3}
                            disabled={busy}
                            onChange={e => setSharedNote(e.target.value)}
                          />
                        </label>
                        <div className={s.actions}>
                          <Button type="button" disabled={busy} onClick={() => void saveSharedNote()}>
                            {tr('保存转账留言')}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setSharedNote(movement.note || '');
                              setEditingNote(false);
                            }}
                          >
                            {tr('取消')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className={s.note}>{movement.note || tr('暂无转账留言')}</p>
                        {movement.sender_id === options.userId && movement.status !== 'cancelled' && (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setEditingNote(true)}
                          >
                            {tr('修改转账留言')}
                          </Button>
                        )}
                      </>
                    )}
                    <p className={s.muted}>
                      {tr('转出人可修改留言；收款人可在讨论中回复。私人备注不会公开。')}
                    </p>
                  </section>
                  {movement.sender_id === options.userId && movement.status !== 'cancelled' && (
                    <section className={correctingSource ? s.section : undefined}>
                      {correctingSource ? (
                        <>
                          <label>
                            {tr('正确的转出钱包')}
                            <VisualSelect
                              label={tr('正确的转出钱包')}
                              value={sourceId}
                              disabled={busy}
                              onChange={setSourceId}
                              options={options.wallets
                                .filter(
                                  (w: any) =>
                                    w.id !== movement.target_id &&
                                    (movement.kind === 'transfer' || w.owner_id === options.userId),
                                )
                                .map((w: any) => ({
                                  value: w.id,
                                  label: Array.from(
                                    new Set([w.name, w.institution, w.suffix].filter(Boolean)),
                                  ).join(' · '),
                                }))}
                            />
                          </label>
                          <p className={s.muted}>
                            {tr(
                              '只更正付款钱包，不会再次转账。已到账时会重算原钱包和新钱包的余额，金额与收款方到账保持不变。',
                            )}
                          </p>
                          <div className={s.actions}>
                            <Button
                              type="button"
                              disabled={busy || !sourceId || sourceId === movement.source_id}
                              onClick={() => setConfirm('source')}
                            >
                              {tr('确认更正钱包')}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setCorrectingSource(false);
                                setSourceError('');
                              }}
                            >
                              {tr('取消')}
                            </Button>
                          </div>
                          {sourceError && (
                            <p className={s.error} role="alert">
                              {tr(sourceError)}
                            </p>
                          )}
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setSourceId(movement.source_id || '');
                            setCorrectingSource(true);
                          }}
                        >
                          {tr('更正转出钱包')}
                        </Button>
                      )}
                    </section>
                  )}
                  <TransactionBalance id={row.id} balances={row.wallet_balances} />
                </div>
              ),
            },
            {
              key: 'record',
              label: tr('我的记录'),
              content: (
                <>
                  <h3>{tr('我的记录')}</h3>
                  <p className={s.muted}>{tr('以下补充信息仅自己可见。')}</p>
                  {editing ? (
                    <div className={s.form}>
                      {movement.recipient_id === options.userId && movement.status === 'confirmed' && (
                        <label>
                          {tr('到账钱包')}
                          <VisualSelect
                            label={tr('到账钱包')}
                            value={targetId}
                            disabled={busy}
                            onChange={setTargetId}
                            options={options.wallets
                              .filter(
                                (w: any) => w.owner_id === options.userId && w.id !== movement.source_id,
                              )
                              .map((w: any) => ({
                                value: w.id,
                                label: Array.from(
                                  new Set([w.name, w.institution, w.suffix].filter(Boolean)),
                                ).join(' · '),
                              }))}
                          />
                          <span className={s.muted}>
                            {tr('修改后，这笔入账会从原钱包移到新钱包，不会重复收款。')}
                          </span>
                        </label>
                      )}
                      {(['title', 'transactionTime', 'platform', 'externalId', 'note'] as const).map(key => (
                        <label key={key}>
                          {
                            {
                              title: tr('记录标题'),
                              transactionTime: tr('交易时间'),
                              platform: tr('支付平台'),
                              externalId: tr('交易流水号'),
                              note: tr('私人备注 · 仅自己可见'),
                            }[key]
                          }
                          {key === 'note' ? (
                            <TextArea
                              aria-label={tr('私人备注 · 仅自己可见')}
                              value={form[key]}
                              maxLength={2000}
                              onChange={e => setForm({ ...form, [key]: e.target.value })}
                            />
                          ) : (
                            <Input
                              type={key === 'transactionTime' ? 'time' : 'text'}
                              maxLength={key === 'platform' ? 60 : 200}
                              value={form[key]}
                              onChange={e => setForm({ ...form, [key]: e.target.value })}
                            />
                          )}
                        </label>
                      ))}
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
                    </div>
                  ) : (
                    <>
                      {form.platform && (
                        <p>
                          {tr('支付平台：')}
                          {form.platform}
                        </p>
                      )}
                      {form.externalId && (
                        <p className={s.note}>
                          {tr('流水号：')}
                          {form.externalId}
                        </p>
                      )}
                      {form.note && (
                        <p>
                          <strong>{tr('私人备注 · 仅自己可见')}</strong>
                        </p>
                      )}
                      {form.note && <p className={s.note}>{form.note}</p>}
                      <p>
                        {tr('记入账本：')}
                        {options.books.find((b: any) => b.id === book)?.name || tr('暂不展示')}
                      </p>
                    </>
                  )}
                </>
              ),
            },
            {
              key: 'discussion',
              label: tr('讨论'),
              content: canEdit ? (
                <Discussion
                  key={row.id}
                  target={{ kind: 'movement', id: row.id }}
                  revision={movement.note || ''}
                />
              ) : (
                <p>{tr('仅往来双方可见')}</p>
              ),
            },
            {
              key: 'attachments',
              label: tr('附件') + ` · ${files.length}`,
              content: (
                <div className={s.stack}>
                  {(['receipt', 'photo'] as const).map(purpose => (
                    <section className={s.section} key={purpose}>
                      <div className={s.attachmentHeading}>
                        <strong>{purpose === 'receipt' ? tr('交易凭证') : tr('生活附图')}</strong>
                        {canEdit && (
                          <label className={s.upload}>
                            <ImagePlus size={18} />
                            {busy ? tr('上传中…') : tr('添加图片')}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              multiple
                              disabled={busy}
                              onChange={e => {
                                void upload(Array.from(e.target.files || []), purpose);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <div className={s.photos}>
                        {files
                          .filter(f => f.purpose === purpose && !removed.includes(f.id))
                          .map(f => (
                            <figure key={f.id}>
                              <a href={'/api/receipts/' + f.id} target="_blank" rel="noreferrer">
                                <img loading="lazy" src={'/api/receipts/' + f.id} alt={f.name} />
                              </a>
                              {editing && (
                                <Button
                                  className={s.remove}
                                  aria-label={tr('移除图片')}
                                  disabled={busy}
                                  onClick={() => setRemoveFile(f.id)}
                                >
                                  <X size={16} />
                                </Button>
                              )}
                            </figure>
                          ))}
                      </div>
                      {!files.some(f => f.purpose === purpose && !removed.includes(f.id)) && (
                        <p className={s.muted}>
                          {tr('尚未添加')}
                          {purpose === 'receipt' ? tr('交易凭证') : tr('生活附图')}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              ),
            },
          ]}
        />
      )}
      {error && (
        <p className={s.error} role="alert">
          {tr(error)}
        </p>
      )}
    </>
  );
  return (
    <Sheet
      open
      wide
      closeLabel={tr('关闭弹窗')}
      title={tr('这笔家庭往来')}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={canEdit ? footer : undefined}
    >
      {content}
    </Sheet>
  );
}
