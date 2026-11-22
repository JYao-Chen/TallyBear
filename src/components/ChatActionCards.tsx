'use client';
import { useConfirmation } from '@/ui/useConfirmation';
import styles from './ChatActionCards.module.css';
import { PreferenceSuggestions } from './PreferenceSuggestions';
import { changeMemorySelection, resolveMemoryField } from '@/lib/memory-fields';
import { MemorySuggestions } from './MemorySuggestions';
import { ChatActionEditor } from './ChatActionEditor';
import { LineItemsView } from './LineItems';
import { Button, Money, Chip, Card } from '@/ui';
import { useState } from 'react';
import {
  ChevronDown,
  Check,
  CalendarClock,
  NotebookPen,
  Repeat,
  ChartPie,
  Wallet,
  Bookmark,
  ArrowRightLeft,
  FilePenLine,
} from 'lucide-react';
import type { LoggedChatAction } from '@/server/chat-actions';
import { actionNames, type ChatAction } from '@/lib/chat-actions';
import { useI18n } from './LanguageProvider';
import { SymbolIcon, AccountIcon } from './VisualSelect';
const icons = {
  management: FilePenLine,
  memory: Bookmark,
  family: ArrowRightLeft,
  entry: NotebookPen,
  transaction: FilePenLine,
  schedule: CalendarClock,
  template: Bookmark,
  budget: ChartPie,
  allocation: Repeat,
  installment: Wallet,
  repayment: ArrowRightLeft,
};
export function ChatActionCards({
  onUndo,
  undone,
  onEdit,
  actions,
  disabled,
  confirmable,
  onConfirm,
  onCancel,
  onRevise,
}: {
  onUndo?: (id: string) => void;
  undone?: Set<string>;
  onEdit: (id: string, data: Record<string, any>) => Promise<void>;
  actions: LoggedChatAction[];
  disabled: boolean;
  confirmable: boolean;
  onConfirm: (id: string, ack: boolean) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRevise: (a: ChatAction) => void;
}) {
  const { t: tr } = useI18n();
  const { requestConfirmation, confirmation } = useConfirmation();
  const [editing, setEditing] = useState('');
  const [saving, setSaving] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [ack, setAck] = useState<Record<string, boolean>>({});
  async function execute(a: ChatAction, cancel = false) {
    if (saving) return;
    setSaving(a.id);
    setErrors(v => ({ ...v, [a.id]: '' }));
    try {
      await (cancel ? onCancel(a.id) : onConfirm(a.id, !!ack[a.id]));
    } catch (e) {
      setErrors(v => ({ ...v, [a.id]: (e as Error).message }));
    } finally {
      setSaving('');
    }
  }
  return (
    <div className={styles.chatActionList}>
      {confirmation}
      {actions.map(a => {
        const { actionLogId, canUndo } = a;
        const Icon = icons[a.kind];
        const pending = a.status === 'pending',
          deleting = a.kind === 'transaction' && a.data.operation === 'delete';
        const main =
          a.kind === 'management' ? tr(a.title) : a.data.title || a.data.name || tr(actionNames[a.kind]);
        return (
          <Card
            className={styles.chatActionCard}
            data-resolved={!pending}
            key={a.id}
            aria-label={tr(actionNames[a.kind])}
          >
            <div className={styles.receiptCardHeading}>
              <span className={styles.chatActionIcon}>
                <Icon size={21} />
              </span>
              <div>
                <small>{tr(actionNames[a.kind])}</small>
                <h3>{main}</h3>
              </div>
              <span className={styles.receiptState} data-status={a.status}>
                {tr(
                  a.status === 'confirmed'
                    ? deleting
                      ? '已删除'
                      : a.kind === 'management'
                        ? '已执行'
                        : a.kind === 'transaction'
                          ? '已修改'
                          : '已保存'
                    : a.status === 'cancelled'
                      ? '已取消'
                      : a.missing.length
                        ? '待补充'
                        : '待确认',
                )}
              </span>
            </div>
            {editing !== a.id && typeof a.data.amount === 'number' && (
              <div className={styles.receiptCardAmount}>
                <span>{tr('金额')}</span>
                <Money
                  tone={a.data.kind === 'expense' || a.data.kind === 'income' ? a.data.kind : 'plain'}
                  value={a.data.amount}
                  size="large"
                />
              </div>
            )}
            {pending && a.missing.length > 0 && (
              <section className={`${styles.receiptNotice} ${styles.receiptNoticeMissing}`}>
                <strong>{tr('请补充信息')}</strong>
                <p>{a.missing.map(m => tr(m)).join('、')}</p>
              </section>
            )}
            {pending && a.warnings.filter(w => !a.data.processingHints?.includes(w)).length > 0 && (
              <section className={`${styles.receiptNotice} ${styles.receiptNoticeWarning}`}>
                <strong>{tr('保存前请核对')}</strong>
                <ul>
                  {a.warnings
                    .filter(w => !a.data.processingHints?.includes(w))
                    .map((w, i) => (
                      <li key={i}>{tr(w)}</li>
                    ))}
                </ul>
              </section>
            )}
            {editing !== a.id && (
              <details className={styles.receiptCardContent}>
                <summary className={styles.disclosure}>
                  {tr('查看卡片详情')}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <dl className={styles.receiptFacts}>
                  {a.summary
                    .filter(s => !(typeof a.data.amount === 'number' && s.label === '金额'))
                    .map((s, i) => (
                      <div
                        className={
                          ['备注', '核验说明', '商品摘要'].includes(s.label) ? styles.receiptFactWide : ''
                        }
                        key={i}
                      >
                        <dt>{tr(s.label)}</dt>
                        <dd>
                          {s.icon && <SymbolIcon icon={s.icon} size={22} />}
                          {s.account && <AccountIcon name={s.account} size={22} />}
                          <span>{s.value}</span>
                        </dd>
                      </div>
                    ))}
                </dl>
                {pending && a.kind === 'entry' && (
                  <PreferenceSuggestions
                    value={a.data as any}
                    disabled={disabled || !!saving}
                    onChange={next => onEdit(a.id, next)}
                  />
                )}
                {pending && (
                  <MemorySuggestions
                    suggestions={a.data.memorySuggestions}
                    name={a.data.product || a.data.title || ''}
                    disabled={disabled || !!saving}
                    onChange={(next, resolution) => {
                      const filled = resolution
                        ? resolveMemoryField(
                            a.data,
                            next,
                            resolution.id,
                            resolution.itemId,
                            resolution.field,
                            resolution.useMemory,
                          )
                        : changeMemorySelection(a.data, a.data.memorySuggestions || [], next);
                      return onEdit(a.id, { ...filled.value, memorySuggestions: filled.suggestions });
                    }}
                  />
                )}
                {a.data.lineItems?.length > 0 && (
                  <LineItemsView
                    category={a.data.category}
                    items={a.data.lineItems}
                    total={a.data.amount || 0}
                  />
                )}
                {pending && Array.isArray(a.data.processingHints) && a.data.processingHints.length > 0 && (
                  <section className={`${styles.receiptNotice} ${styles.receiptNoticeInfo}`}>
                    <strong>{tr('识别与处理说明')}</strong>
                    <ul>
                      {a.data.processingHints.map((w: string, i: number) => (
                        <li key={i}>{tr(w)}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </details>
            )}
            {pending &&
              editing !== a.id &&
              a.kind === 'entry' &&
              (a.warnings.some(w => /重复|退款|duplicate|refund/i.test(w)) ||
                /重复|退款|duplicate|refund/i.test(errors[a.id] || '')) && (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={!!ack[a.id]}
                    onChange={e => setAck(v => ({ ...v, [a.id]: e.target.checked }))}
                  />
                  {tr('已核对重复与退款提示，仍保存为独立账单')}
                </label>
              )}
            {errors[a.id] && (
              <p className={styles.error} role="alert">
                {tr(errors[a.id])}
              </p>
            )}
            {pending && editing === a.id && (
              <ChatActionEditor
                action={a}
                onSave={async data => {
                  await onEdit(a.id, data);
                  setAck(v => ({ ...v, [a.id]: false }));
                  setEditing('');
                }}
                onCancel={() => setEditing('')}
              />
            )}
            {a.status === 'confirmed' &&
              actionLogId &&
              (undone?.has(actionLogId) ? (
                <Chip>{tr('已撤销')}</Chip>
              ) : canUndo && onUndo ? (
                <Button size="sm" disabled={disabled} onClick={() => onUndo(actionLogId)}>
                  {tr('撤销')}
                </Button>
              ) : (
                <small>{tr('不可撤销')}</small>
              ))}
            {pending
              ? editing !== a.id && (
                  <div className={styles.receiptCardActions}>
                    <div className={styles.receiptPrimaryActions}>
                      <Button
                        variant={deleting ? 'danger' : 'primary'}
                        disabled={disabled || !confirmable || !!saving || !!editing || !!a.missing.length}
                        onClick={() => {
                          if (
                            deleting ||
                            a.kind === 'management' ||
                            (a.kind === 'memory' && ['share', 'forget'].includes(a.data.operation))
                          )
                            requestConfirmation(
                              <>
                                {tr(a.title)}
                                <ul>
                                  {a.summary.map((item, i) => (
                                    <li key={i}>
                                      {tr(item.label)} · {item.value}
                                    </li>
                                  ))}
                                </ul>
                              </>,
                              () => execute(a),
                            );
                          else void execute(a);
                        }}
                      >
                        <Check size={17} />
                        {tr(
                          saving === a.id
                            ? '处理中…'
                            : deleting
                              ? '确认删除'
                              : a.kind === 'management'
                                ? '确认执行'
                                : a.kind === 'transaction'
                                  ? '确认修改'
                                  : '确认保存',
                        )}
                      </Button>
                      {!deleting && a.kind !== 'management' && (
                        <Button disabled={disabled || !!saving || !!editing} onClick={() => setEditing(a.id)}>
                          {tr(a.missing.length ? '补充信息' : '继续修改')}
                        </Button>
                      )}
                    </div>
                    <div className={styles.receiptSecondaryActions}>
                      <Button
                        variant="ghost"
                        disabled={disabled || !!saving || !!editing}
                        onClick={() => onRevise(a)}
                      >
                        {tr('通过对话修改')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={disabled || !!saving || !!editing}
                        onClick={() => execute(a, true)}
                      >
                        {tr('取消这张卡片')}
                      </Button>
                    </div>
                  </div>
                )
              : a.confirmedAt && (
                  <small className={styles.muted}>{new Date(a.confirmedAt).toLocaleString()}</small>
                )}
          </Card>
        );
      })}
    </div>
  );
}
