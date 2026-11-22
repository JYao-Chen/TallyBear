'use client';
import { FormSelect } from './FormSelect';
import { Button, Field, Input, TextArea } from '@/ui';
import styles from './CostSettlementTransfer.module.css';
import shared from './WorkspacePlans.module.css';
import { Discussion } from './Discussion';
import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { PagedList } from './PagedList';

// Operate: extend the existing cost surface. Real transfers and cost shares stay distinct;
// inline forms retain the theme, and receipt confirmation belongs to the recipient.
type Movement = {
  movement_id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  status: string;
  date: string;
  note: string;
};
type Project = {
  id: string;
  version: number;
  familyId: string | null;
  active: boolean;
  valid: boolean;
  archived: boolean;
  movements: Movement[];
  members: { user_id: string; name: string }[];
};
export function CostSettlementTransfer({
  project,
  userId,
  onChanged,
}: {
  project: Project;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [reply, setReply] = useState(''),
    [discussionMovement, setDiscussionMovement] = useState('');
  const [editing, setEditing] = useState(false),
    [id, setId] = useState(''),
    [recipient, setRecipient] = useState(''),
    [source, setSource] = useState(''),
    [amount, setAmount] = useState(''),
    [date, setDate] = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })),
    [note, setNote] = useState(''),
    [similar, setSimilar] = useState(false),
    [receiving, setReceiving] = useState(''),
    [target, setTarget] = useState('');
  useEffect(() => {
    let live = true;
    fetch('/api/assets')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Request failed');
        return d;
      })
      .then(d => {
        if (live) setWallets(d.filter((a: any) => a.owner_id === userId && !a.archived));
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
  }, [userId]);
  const person = (id: string) => project.members.find(m => m.user_id === id)?.name || tr('成员');
  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch(`/api/cost-projects/${project.id}/settlement-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: project.version, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Request failed');
      setEditing(false);
      setReceiving('');
      setNotice(
        body.operation === 'create'
          ? tr('转款已记录，等待对方确认到账；确认后自动计入本项目结算。')
          : body.operation === 'confirm'
            ? tr('已确认到账，钱包余额和项目结算已更新。')
            : tr('已取消待确认转款，未计入结算。'),
      );
      window.dispatchEvent(new Event('cost-payment-recorded'));
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!project.familyId) return null;
  return (
    <div className={styles.costTransfer} aria-label={tr('成员转款与收款')}>
      <div className={shared.toolbar}>
        <h4>{tr('成员转款与收款')}</h4>
        <Button
          variant="ghost"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onChanged();
            } finally {
              setBusy(false);
            }
          }}
        >
          <RefreshCw size={16} />
          {tr('刷新状态')}
        </Button>
      </div>
      <p className={shared.muted}>
        {tr(
          '这里记录真实成员转款，不重复记房租等费用。双方余额在收款人确认后更新；个人承担仍按分摊规则统计。',
        )}
      </p>
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
      {!editing ? (
        <Button
          variant="primary"
          type="button"
          disabled={busy || loading || !project.active || !project.valid || project.archived}
          onClick={() => {
            setId(crypto.randomUUID());
            setRecipient('');
            setSource('');
            setAmount('');
            setNote('');
            setSimilar(false);
            setEditing(true);
            setReceiving('');
            setError('');
          }}
        >
          {tr('向成员结算')}
        </Button>
      ) : (
        <form
          onSubmit={e => {
            e.preventDefault();
            void act({
              operation: 'create',
              id,
              sourceId: source,
              recipientId: recipient,
              amount: Math.round(Number(amount) * 100),
              date,
              note,
              allowSimilar: similar,
            });
          }}
        >
          <fieldset disabled={busy || loading}>
            <legend>{tr('记录已发生的转款')}</legend>
            <div className={shared.grid}>
              <Field label={tr('收款成员')}>
                {() => (
                  <FormSelect
                    aria-label={tr('收款成员')}
                    required
                    value={recipient}
                    onChange={next => setRecipient(next)}
                  >
                    <option value="">{tr('选择成员')}</option>
                    {project.members
                      .filter(m => m.user_id !== userId)
                      .map(m => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name}
                        </option>
                      ))}
                  </FormSelect>
                )}
              </Field>
              <Field label={tr('我的付款钱包')}>
                {() => (
                  <FormSelect
                    aria-label={tr('我的付款钱包')}
                    required
                    value={source}
                    onChange={next => setSource(next)}
                  >
                    <option value="">{tr('选择钱包')}</option>
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </FormSelect>
                )}
              </Field>
              <Field label={tr('实际转款金额')}>
                {control => (
                  <Input
                    {...control}
                    required
                    type="number"
                    min="0.01"
                    max="1000000000"
                    step="0.01"
                    className={shared.numeric}
                    inputMode="decimal"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                )}
              </Field>
              <Field label={tr('转款日期')}>
                {control => (
                  <Input
                    {...control}
                    required
                    type="date"
                    max={new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label={tr('转账留言（选填，收款人可见）')}>
              {control => (
                <Input {...control} maxLength={500} value={note} onChange={e => setNote(e.target.value)} />
              )}
            </Field>
            <label className={shared.check}>
              <input type="checkbox" checked={similar} onChange={e => setSimilar(e.target.checked)} />
              {tr('同日同金额仍是另一笔真实转款')}
            </label>
            {!loading && !wallets.length && (
              <p className={shared.error}>{tr('请先在资金资产中添加个人钱包。')}</p>
            )}
            <p className={shared.muted}>
              {tr('不代替微信或银行转账。已在家庭往来记过的，请使用下方“关联已有结算”。')}
            </p>
            <div className={shared.toolbar}>
              <Button variant="primary" type="submit" disabled={!wallets.length}>
                {busy ? tr('正在记录…') : tr('已转款，等待对方确认')}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
                {tr('取消')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <h4>{tr('本项目的结算流水')}</h4>
      {!project.movements.length && (
        <p className={shared.muted}>{tr('还没有成员结算记录。转款后在这里记录，或关联已有转账。')}</p>
      )}
      <PagedList items={project.movements}>
        {m => (
          <div className={shared.row}>
            <div className={shared.toolbar}>
              <span>
                {person(m.sender_id)} <ArrowRight size={14} aria-hidden="true" /> {person(m.recipient_id)}
              </span>
              <strong>{formatMoney(m.amount)}</strong>
            </div>
            <small>
              {m.date} ·{' '}
              {m.status === 'confirmed'
                ? tr('已到账 · 已计入结算')
                : m.status === 'cancelled'
                  ? tr('已取消')
                  : tr('待收款人确认 · 未计入结算')}
            </small>
            {m.note && <p>{m.note}</p>}
            {[m.sender_id, m.recipient_id].includes(userId) && (
              <>
                <Button
                  variant="ghost"
                  type="button"
                  aria-expanded={discussionMovement === m.movement_id}
                  onClick={() => setDiscussionMovement(v => (v === m.movement_id ? '' : m.movement_id))}
                >
                  {tr('转款讨论')}
                </Button>
                {discussionMovement === m.movement_id && (
                  <Discussion key={m.movement_id} target={{ kind: 'movement', id: m.movement_id }} />
                )}
              </>
            )}
            {m.status === 'pending' && [m.sender_id, m.recipient_id].includes(userId) && (
              <div className={shared.toolbar}>
                {m.recipient_id === userId && (
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy || loading}
                    onClick={() => {
                      setReceiving(m.movement_id);
                      setReply('');
                      setTarget('');
                      setEditing(false);
                    }}
                  >
                    {tr('确认到账')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ operation: 'cancel', id: m.movement_id })}
                >
                  {tr('取消这笔待确认转款')}
                </Button>
              </div>
            )}
            {receiving === m.movement_id && m.status === 'pending' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  void act({ operation: 'confirm', id: m.movement_id, targetId: target, reply });
                }}
              >
                <fieldset disabled={busy}>
                  <Field label={tr('我的到账钱包')}>
                    {() => (
                      <FormSelect
                        aria-label={tr('我的到账钱包')}
                        required
                        value={target}
                        onChange={next => setTarget(next)}
                      >
                        <option value="">{tr('选择实际到账钱包')}</option>
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </FormSelect>
                    )}
                  </Field>
                  <Field label={tr('回复转账人（选填，对方可见）')}>
                    {control => (
                      <TextArea
                        {...control}
                        maxLength={2000}
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                      />
                    )}
                  </Field>
                  {!loading && !wallets.length && (
                    <p className={shared.error}>{tr('请先在资金资产中添加个人钱包，再回来确认到账。')}</p>
                  )}
                  <p>
                    {tr('确认后该钱包增加')} {formatMoney(m.amount)}
                    {tr('，不会计为收入或再增加费用。')}
                  </p>
                  <div className={shared.toolbar}>
                    <Button variant="primary" type="submit" disabled={loading || !wallets.length}>
                      {tr('确已到账，确认结算')}
                    </Button>
                    <Button variant="ghost" type="button" onClick={() => setReceiving('')}>
                      {tr('返回')}
                    </Button>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        )}
      </PagedList>
    </div>
  );
}
