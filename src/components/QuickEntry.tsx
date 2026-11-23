'use client';
import styles from './QuickEntry.module.css';
import { Button, Field, Input, Segmented, FilledBadge } from '@/ui';
import { EntryInstallmentFields } from './EntryInstallmentFields';
import { claimRequest } from './ExpenseClaims';
import { ClaimRecipientSelect } from './ClaimRecipientSelect';
import { PreferenceSuggestions } from './PreferenceSuggestions';
import { MemorySuggestions } from './MemorySuggestions';
import { changeMemorySelection, resolveMemoryField } from '@/lib/memory-fields';
import { ReceiptOriginHint } from './ReceiptOriginHint';
import { normalizeTransactionTime, recordingDate } from '@/lib/entry-time';
import { manualEntryDate } from '@/lib/manual-entry-date';
import { SceneFields } from './SceneFields';
import { emptyScene } from '@/lib/entry-scene';
import type { ManagedBook } from './ManagementPages';
import { DateField } from './DateField';
import { formatMoney, currencySymbol } from '@/lib/deployment';
import { useI18n } from './LanguageProvider';
import { TransactionPhotos } from './TransactionPhotos';
import { VerificationConfirm } from './VerificationConfirm';
import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import { VisualSelect } from './VisualSelect';
import { FormSelect } from './FormSelect';
import { CategoryPicker } from './CategoryPicker';
import { ChevronUp, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LineItemsEditor } from './LineItems';
import type { LineItem } from '@/lib/line-items';
import { RefundPicker } from './RefundPicker';
import { amountToCents } from '@/server/model';
import type { Draft, Original } from './DraftReview';
import type { SearchResult } from './GlobalSearch';
import { purchaseDefaults, purchaseFromRow } from '@/lib/purchase-memory';
import { ActivitySelect } from './ActivitySelect';

function id() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export function QuickEntry({
  book,
  books,
  initial,
  savedDraft,
  reviewDraft,
  editedFields = [],
  localDrafts,
  onDraftChange,
  categories,
  recentCategories = [],
  accounts,
  originals,
  onSave,
  onCancel,
}: {
  book: string;
  books: ManagedBook[];
  recentCategories?: string[];
  categories: { name: string; icon: string; archived: boolean }[];
  initial?: Draft;
  reviewDraft?: Draft;
  editedFields?: (keyof Draft)[];
  localDrafts?: Draft[];
  savedDraft?: Partial<Draft>;
  onDraftChange?: (draft: Partial<Draft>) => void;
  accounts: (AccountIdentity & { id: string; family_id?: string | null })[];
  originals: Original[];
  onSave: (entry: Draft, again?: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const { t: tr, locale } = useI18n();
  const choices = categories.filter(c => !c.archived).map(c => [c.name, c.icon]);
  const frequency = new Map<string, number>();
  for (const name of recentCategories) frequency.set(name, (frequency.get(name) || 0) + 1);
  const categoryOptions = choices
    .map(([value, icon]) => ({ value, label: value, icon }))
    .sort((a, b) => (frequency.get(b.value) || 0) - (frequency.get(a.value) || 0));
  const pendingId = useRef<string | null>(initial?.id || reviewDraft?.id || savedDraft?.id || null),
    change = useRef(onDraftChange);
  change.current = onDraftChange;
  const seed = initial || reviewDraft || savedDraft;
  const [changed, setChanged] = useState<Set<keyof Draft>>(() => new Set(editedFields));
  const [filled, setFilled] = useState<Set<keyof Draft>>(new Set());
  const mark = (key: keyof Draft) => setChanged(old => new Set(old).add(key));
  const badge = (key: keyof Draft) =>
    filled.has(key) || (reviewDraft && !reviewDraft.source?.startsWith('CSV') && reviewDraft[key]) ? (
      <span className={styles.provenance}>
        <FilledBadge>{changed.has(key) ? tr('已修改') : undefined}</FilledBadge>
      </span>
    ) : null;
  const [claimRecipient, setClaimRecipient] = useState(seed?.claimRecipientId || '');
  const [claimInfo, setClaimInfo] = useState<{
    canInvite: boolean;
    claim: { recipient_id: string; recipient_name: string; status: string } | null;
  } | null>(null);
  const [claimLoadError, setClaimLoadError] = useState(''),
    [claimRetry, setClaimRetry] = useState(0);
  useEffect(() => {
    if (!initial || initial.kind !== 'expense') return;
    let live = true;
    setClaimInfo(null);
    setClaimLoadError('');
    claimRequest('for-record?id=' + initial.id)
      .then(d => {
        if (live) {
          setClaimInfo(d);
          setClaimRecipient(d.claim?.recipient_id || '');
        }
      })
      .catch(e => {
        if (live) setClaimLoadError(e.message);
      });
    return () => {
      live = false;
    };
  }, [initial?.id, initial?.kind, claimRetry]);
  const [destination, setDestination] = useState(seed?.targetBook || book);
  const [activityId, setActivityId] = useState(seed?.activityId || '');
  useEffect(() => {
    if (!initial && !reviewDraft) setActivityId(savedDraft?.activityId || '');
  }, [initial, savedDraft?.activityId]);
  const [activityLoaded, setActivityLoaded] = useState(!initial);
  useEffect(() => {
    if (!initial) return;
    setActivityLoaded(false);
    const controller = new AbortController();
    fetch(`/api/activities/entry?book=${encodeURIComponent(book)}&id=${encodeURIComponent(initial.id)}`, {
      signal: controller.signal,
    })
      .then(async response => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        if (!controller.signal.aborted) {
          setActivityId(value.activityId || '');
          setActivityLoaded(true);
        }
      })
      .catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [book, initial?.id]);
  const [occurredAt, setOccurredAt] = useState(seed?.occurredAt ?? '');
  const [scene, setScene] = useState(seed?.scene || emptyScene());
  const [title, setTitle] = useState(seed?.title || '');
  const [photoIds, setPhotoIds] = useState(seed?.photoIds || []),
    [photoBusy, setPhotoBusy] = useState(false);
  const [retainReceipts, setRetainReceipts] = useState(seed?.retainReceipts ?? false);
  const [verificationReason, setVerificationReason] = useState(seed?.verificationReason || ''),
    [attachmentIds, setAttachmentIds] = useState(seed?.attachmentIds || []);
  const [lineItems, setLineItems] = useState<LineItem[]>(seed?.lineItems || []),
    [recognizing, setRecognizing] = useState(false);
  const [platform, setPlatform] = useState(seed?.platform || ''),
    [orderId, setOrderId] = useState(seed?.orderId || ''),
    [externalId, setExternalId] = useState(seed?.externalId || '');
  const [kind, setKind] = useState<Draft['kind']>(seed?.kind || 'expense'),
    [amount, setAmount] = useState(seed?.amount ? String(seed.amount / 100) : ''),
    [date, setDate] = useState(reviewDraft?.date ?? (initial?.date || manualEntryDate(savedDraft))),
    [account, setAccount] = useState(reviewDraft?.accountId ?? (seed?.accountId || accounts[0]?.id || '')),
    [target, setTarget] = useState(seed?.targetId || ''),
    [category, setCategory] = useState(
      reviewDraft?.category ?? (seed?.category || choices[0]?.[0] || tr('其他')),
    ),
    [payee, setPayee] = useState(seed?.payee || ''),
    [note, setNote] = useState(seed?.note || ''),
    [product, setProduct] = useState(seed?.product || ''),
    [refund, setRefund] = useState(seed?.refundOf || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [walletNotice, setWalletNotice] = useState('');
  const [installment, setInstallment] = useState(seed?.installment || null);
  const [draftAction, setDraftAction] = useState<'create' | 'skip' | 'merge'>(
    reviewDraft?.action || 'create',
  );
  const [mergeId, setMergeId] = useState(reviewDraft?.mergeId || '');
  const [mergeVersion, setMergeVersion] = useState<number | undefined>(reviewDraft?.mergeVersion);
  const [preferenceSuggestions, setPreferenceSuggestions] = useState(reviewDraft?.preferenceSuggestions);
  const [memorySuggestions, setMemorySuggestions] = useState(reviewDraft?.memorySuggestions);
  const [categorySuggestion, setCategorySuggestion] = useState(reviewDraft?.categorySuggestion);
  const [openExtras, setOpenExtras] = useState<Set<string>>(() => {
    const open = new Set<string>();
    if (seed?.payee || seed?.platform || seed?.product) open.add('merchant');
    if (seed?.lineItems?.length) open.add('items');
    if (seed?.scene && JSON.stringify(seed.scene) !== JSON.stringify(emptyScene())) open.add('scene');
    if (seed?.note) open.add('note');
    if (seed?.orderId || seed?.externalId) open.add('order');
    if (seed?.activityId) open.add('activity');
    if (seed?.installment) open.add('installment');
    if (seed?.photoIds?.length) open.add('photos');
    return open;
  });
  useEffect(() => {
    if (!reviewDraft) return;
    if (reviewDraft.walletMatch === 'channel')
      setWalletNotice('已按支付渠道自动选择，请核对是否为实际扣款账户。');
    else if (reviewDraft.walletMatch === 'funding')
      setWalletNotice('已根据明确扣款信息自动选择。');
    else if (!reviewDraft.accountId && (reviewDraft.walletCandidates?.length || 0) > 1)
      setWalletNotice('找到多个符合付款信息的钱包，请选择实际扣款账户。');
  }, [reviewDraft]);
  const [repaying, setRepaying] = useState(
    seed?.kind === 'transfer' && accounts.some(a => a.id === seed?.targetId && a.type === 'credit'),
  );
  const [debts, setDebts] = useState<{ id: string; balance: number }[]>([]),
    [debtError, setDebtError] = useState('');
  useEffect(() => {
    if (!repaying) return;
    const c = new AbortController();
    setDebtError('');
    fetch('/api/assets', { signal: c.signal })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        return d;
      })
      .then(setDebts)
      .catch(e => {
        if (!c.signal.aborted) setDebtError(e.message);
      });
    return () => c.abort();
  }, [repaying, saved]);
  useEffect(() => {
    if (initial || reviewDraft) return;
    let cents = 0;
    try {
      cents = amount ? amountToCents(amount) : 0;
    } catch {
      return;
    }
    pendingId.current ??= id();
    change.current?.({
      claimRecipientId: kind === 'expense' ? claimRecipient || null : null,
      targetBook: destination,
      id: pendingId.current,
      activityId: activityId || null,
      installment: kind === 'expense' ? installment : null,
      kind,
      amount: cents,
      date,
      accountId: account,
      targetId: target,
      category,
      payee,
      note,
      product,
      platform,
      orderId,
      externalId,
      lineItems,
      verificationReason,
      attachmentIds,
      retainReceipts,
      photoIds,
      title,
      scene,
      occurredAt,
      refundOf: refund || null,
    });
  }, [
    kind,
    installment,
    amount,
    date,
    account,
    target,
    category,
    payee,
    note,
    product,
    platform,
    orderId,
    externalId,
    refund,
    lineItems,
    verificationReason,
    attachmentIds,
    retainReceipts,
    photoIds,
    title,
    scene,
    occurredAt,
    initial,
    destination,
    activityId,
    claimRecipient,
  ]);
  function fillFromOriginal(row: SearchResult) {
    setChanged(
      old =>
        new Set<keyof Draft>([
          ...old,
          'title',
          'payee',
          'product',
          'category',
          'platform',
          'note',
          'scene',
          'lineItems',
          'orderId',
          'externalId',
          'accountId',
        ]),
    );
    const value = purchaseDefaults(purchaseFromRow(row.detail), true);
    setTitle(value.title);
    setPayee(value.payee);
    setProduct(value.product);
    setCategory(value.category);
    setPlatform(value.platform);
    setNote(value.note);
    setScene(value.scene);
    setLineItems(value.lineItems);
    setVerificationReason('');
    setOrderId(row.detail.order_id || '');
    setExternalId('');
    if (accounts.some(a => a.id === row.detail.account_id)) setAccount(row.detail.account_id);
    setDestination(row.book_id);
    setRefund(row.id);
    setWalletNotice('已填充原单信息，退款记入原单所在账本；请核对到账钱包和本次金额。');
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const again = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === 'again';
    if (busy || recognizing || photoBusy || !activityLoaded) return;
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      const cents = amount ? amountToCents(amount) : 0;
      if (
        repaying &&
        draftAction !== 'skip' &&
        draftAction !== 'merge' &&
        (!accounts.some(a => a.id === target && a.type === 'credit') ||
          !accounts.some(a => a.id === account && a.type !== 'credit') ||
          account === target)
      )
        throw new Error(tr('请选择付款钱包和要还款的信用账户'));
      if (draftAction === 'merge' && (!mergeId || !mergeVersion))
        throw new Error(tr('请选择已有记录'));
      if (draftAction !== 'skip' && draftAction !== 'merge' && !cents)
        throw new Error('请输入大于0的金额');
      pendingId.current ??= initial?.id || id();
      await onSave(
        {
          ...seed,
          ...(reviewDraft
            ? {
                action: draftAction,
                mergeId: draftAction === 'merge' ? mergeId : undefined,
                mergeVersion: draftAction === 'merge' ? mergeVersion : undefined,
                preferenceSuggestions,
                memorySuggestions,
                categorySuggestion,
                categorySource: changed.has('category') ? 'explicit' : reviewDraft.categorySource,
              }
            : {}),
          ...(!initial
            ? { claimRecipientId: kind === 'expense' ? claimRecipient || null : null }
            : kind === 'expense' &&
                claimInfo?.canInvite &&
                claimInfo.claim?.status !== 'accepted' &&
                claimRecipient !== (claimInfo.claim?.recipient_id || '')
              ? { claimRecipientId: claimRecipient || null }
              : {}),
          targetBook: destination,
          id: pendingId.current,
          activityId: activityId || null,
          installment: kind === 'expense' ? installment : null,
          kind,
          amount: cents,
          date,
          accountId: account,
          targetId: kind === 'transfer' ? target : null,
          refundOf: kind === 'refund' ? refund || null : null,
          category,
          payee,
          note,
          product,
          platform,
          orderId,
          externalId,
          verificationReason,
          attachmentIds,
          retainReceipts,
          photoIds,
          title: title || (repaying ? tr('信用账户还款') : ''),
          scene,
          occurredAt,
          lineItems: kind === 'transfer' ? [] : lineItems,
        },
        again,
      );
      pendingId.current = null;
      if (!initial && !reviewDraft) {
        setChanged(new Set());
        setFilled(new Set());
        setInstallment(null);
        if (!again) setDate(recordingDate());
        setClaimRecipient('');
        setAmount('');
        setRefund('');
        setTitle('');
        setScene(emptyScene());
        setOccurredAt('');
        setPayee('');
        setNote('');
        setProduct('');
        setPlatform('');
        setOrderId('');
        setExternalId('');
        setLineItems([]);
        setVerificationReason('');
        setAttachmentIds([]);
        setPhotoIds([]);
        setWalletNotice('');
        setSaved(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存未完成，请重试');
    } finally {
      setBusy(false);
    }
  }
  const sceneFilled = JSON.stringify(scene) !== JSON.stringify(emptyScene());
  const extras = [
    {
      key: 'merchant',
      label: kind === 'income' ? '付款方与平台' : '商家与平台',
      summary: payee || platform || product,
    },
    ...(kind === 'transfer'
      ? []
      : [
          {
            key: 'items',
            label: '商品与优惠费用',
            summary: lineItems.length ? tr('{0} 项', [lineItems.length]) : '',
          },
          { key: 'scene', label: '消费场景', summary: sceneFilled ? '✓' : '' },
        ]),
    { key: 'note', label: '备注', summary: note.slice(0, 16) },
    { key: 'order', label: '订单号与流水号', summary: orderId || externalId ? '✓' : '' },
    { key: 'activity', label: '活动', summary: activityId ? '✓' : '' },
    ...(kind === 'expense' ? [{ key: 'installment', label: '分期', summary: installment ? '✓' : '' }] : []),
    { key: 'photos', label: '生活附图', summary: photoIds.length ? String(photoIds.length) : '' },
  ];
  const toggleExtra = (key: string) =>
    setOpenExtras(old => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const applyPreferenceState = (next: Draft) => {
    setKind(next.kind);
    setTitle(next.title || '');
    setPayee(next.payee || '');
    setPlatform(next.platform || '');
    setProduct(next.product || '');
    setNote(next.note || '');
    setCategory(next.category || category);
    setAccount(next.accountId || account);
    setDestination(next.targetBook || destination);
    if (next.scene) setScene(next.scene);
    setPreferenceSuggestions(next.preferenceSuggestions);
    setMemorySuggestions(next.memorySuggestions);
    if (next.payee || next.platform || next.product) setOpenExtras(old => new Set(old).add('merchant'));
    if (next.note) setOpenExtras(old => new Set(old).add('note'));
    if (next.scene && JSON.stringify(next.scene) !== JSON.stringify(emptyScene()))
      setOpenExtras(old => new Set(old).add('scene'));
  };
  const draftStateSnapshot: Draft = {
    ...(reviewDraft || ({ id: pendingId.current || 'draft' } as Draft)),
    kind,
    title,
    payee,
    platform,
    product,
    note,
    category,
    accountId: account,
    targetBook: destination,
    scene,
    amount: (() => {
      try {
        return amount ? amountToCents(amount) : 0;
      } catch {
        return reviewDraft?.amount || 0;
      }
    })(),
    date,
    preferenceSuggestions,
    memorySuggestions,
  };
  return (
    <form aria-label={tr('手动记账')} className={styles.form} onSubmit={save}>
      {reviewDraft && (
        <div className={styles.reviewBanners}>
          {reviewDraft.status === 'unknown' && (
            <p className={styles.attentionNotice}>
              {tr('付款状态不明确，请确认这笔钱已实际支付或到账。')}
            </p>
          )}
          {!!reviewDraft.matches?.length && (
            <div className={styles.attentionNotice}>
              <strong>{tr('发现可能重复的记录')}</strong>
              {reviewDraft.matches.map(m => (
                <p key={m.record.id}>
                  {m.reason} · {m.record.date} {m.record.payee} {formatMoney(m.record.amount)}
                  {m.record.version ? tr(' · 已入账') : tr(' · 本批草稿')}
                </p>
              ))}
            </div>
          )}
          <div className={styles.meta}>
            <label>
              {tr('这笔如何处理')}
              <FormSelect
                value={draftAction}
                onChange={selectedValue => {
                  const nextAction = (selectedValue || 'create') as 'create' | 'skip' | 'merge';
                  setDraftAction(nextAction);
                  if (nextAction === 'merge') setDestination(book);
                }}
              >
                <option value="create">{tr('新增一笔（确认是独立交易）')}</option>
                <option value="skip">{tr('跳过，不入账')}</option>
                {reviewDraft.matches?.some(m => m.record.version) && (
                  <option value="merge">{tr('只补充已有记录的信息')}</option>
                )}
              </FormSelect>
            </label>
            {draftAction === 'merge' && (
              <label>
                {tr('补充到哪笔')}
                <FormSelect
                  value={mergeId}
                  onChange={selectedValue => {
                    const r = reviewDraft.matches?.find(m => m.record.id === selectedValue)?.record;
                    setMergeId(r?.id || '');
                    setMergeVersion(r?.version);
                  }}
                >
                  <option value="">{tr('请选择已有记录')}</option>
                  {reviewDraft.matches
                    ?.filter(m => m.record.version)
                    .map(m => (
                      <option key={m.record.id} value={m.record.id}>
                        {m.record.date} {m.record.payee} {formatMoney(m.record.amount)}
                      </option>
                    ))}
                </FormSelect>
              </label>
            )}
          </div>
          <ReceiptOriginHint origin={reviewDraft.receiptOrigin} />
          <PreferenceSuggestions value={draftStateSnapshot} onChange={applyPreferenceState} disabled={busy} />
          <MemorySuggestions
            suggestions={memorySuggestions}
            name={product || title || ''}
            disabled={busy}
            onChange={(next, resolution) => {
              const filled = resolution
                ? resolveMemoryField(
                    draftStateSnapshot,
                    next,
                    resolution.id,
                    resolution.itemId,
                    resolution.field,
                    resolution.useMemory,
                  )
                : changeMemorySelection(draftStateSnapshot, memorySuggestions || [], next);
              applyPreferenceState({ ...filled.value, memorySuggestions: filled.suggestions });
            }}
          />
          {categorySuggestion && (
            <p aria-live="polite" className={styles.notice}>
              <strong>
                {tr(category !== categorySuggestion.category ? '已采用你的修正' : '个人分类习惯')}
              </strong>
              <span>
                {tr(
                  (
                    {
                      template: '常用一笔',
                      route: '相同路线',
                      merchant_context: '相同商家与商品',
                      merchant: '相同商家',
                      context: '相似商品',
                    } as Record<string, string>
                  )[categorySuggestion.basis],
                )}{' '}
                · {tr('匹配度')} {Math.round(categorySuggestion.confidence * 100)}% ·{' '}
                {categorySuggestion.evidenceCount}
                {tr('条个人记录')}
              </span>
              <small>
                {tr(
                  category !== categorySuggestion.category
                    ? '保存后会优先学习这次修正。'
                    : '这是预选建议，保存前仍可修改。',
                )}
              </small>
            </p>
          )}
        </div>
      )}
      {draftAction === 'skip' || draftAction === 'merge' ? null : (
        <div className={styles.columns}>
        <div className={styles.core}>
          <Segmented
            className={styles.types}
            label={tr('记账类型')}
            value={repaying ? 'repayment' : kind}
            options={(
              [
                ['expense', '支出'],
                ['income', '收入'],
                ['refund', '退款'],
                ['transfer', '转账'],
                ['repayment', '还款'],
              ] as const
            ).map(([value, key]) => ({ value, label: tr(key), disabled: busy }))}
            onChange={value => {
              mark('kind');
              setRepaying(value === 'repayment');
              setKind(value === 'repayment' ? 'transfer' : value);
              if (value === 'income' && category === '餐饮') setCategory('工资');
              if (value === 'expense' && category === '工资') setCategory('餐饮');
              if (value === 'repayment') {
                if (!accounts.some(a => a.id === account && a.type !== 'credit'))
                  setAccount(accounts.find(a => a.type !== 'credit')?.id || '');
                if (!accounts.some(a => a.id === target && a.type === 'credit'))
                  setTarget(accounts.find(a => a.type === 'credit')?.id || '');
              }
            }}
          />
          {badge('kind')}
          {repaying && (
            <p className={styles.notice}>
              {debtError ||
                (() => {
                  const debt = debts.find(a => a.id === target);
                  if (!debt) return !target ? tr('请先在资金资产中创建信用账户。') : tr('正在读取欠款…');
                  let paid = 0;
                  try {
                    paid = amountToCents(amount || '0');
                  } catch {}
                  return tr('当前账面欠款 {0}，本次还款后欠款 {1}。', [
                    formatMoney(Math.max(0, -debt.balance)),
                    formatMoney(Math.max(0, -debt.balance - paid)),
                  ]);
                })()}
              <br />
              {tr(
                '本金只减少欠款，不重复计支出；利息、手续费请另记支出。已建立分期的还款请从原分期计划操作，避免重复记录。',
              )}
            </p>
          )}
          <label className={styles.amount}>
            {kind === 'refund'
              ? tr('实际退回多少钱？')
              : kind === 'income'
                ? tr('收到多少钱？')
                : tr('这一笔多少钱？')}
            {badge('amount')}
            <div>
              <span>{currencySymbol()}</span>
              <Input
                aria-label={tr('金额（元）')}
                inputMode="decimal"
                placeholder={reviewDraft ? tr('请补充金额') : '0.00'}
                value={amount}
                required
                disabled={busy}
                onChange={e => {
                  mark('amount');
                  setAmount(e.target.value);
                }}
                autoComplete="off"
              />
            </div>
          </label>
          <Field
            label={
              <>
                {tr('账目标题')} {badge('title')}
              </>
            }
          >
            {props => (
              <Input
                {...props}
                aria-label={tr('账目标题')}
                value={title}
                maxLength={80}
                placeholder={payee || tr('例如：盒马购物、七鲜买菜、店名 · 晚餐')}
                onChange={e => {
                  mark('title');
                  setTitle(e.target.value);
                }}
              />
            )}
          </Field>
          {scene.purchaseGroup && (
            <p className={styles.muted}>
              {tr('已关联历史同款，可在全局搜索中查看同款购买。')}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScene(s => ({ ...s, purchaseGroup: undefined }))}
              >
                {tr('取消同款关联')}
              </Button>
            </p>
          )}
          {saved && !onDraftChange && (
            <p className={styles.notice} role="status">
              {tr('这一笔已记好，可以继续记下一笔。')}
            </p>
          )}
          {kind !== 'transfer' && (
            <div className={styles.category}>
              <span className={styles.label}>
                {tr('记在哪一类？')}
                {badge('category')}
              </span>
              <CategoryPicker
                label={tr('记在哪一类？')}
                value={category}
                disabled={busy}
                onChange={v => {
                  mark('category');
                  setCategory(v);
                }}
                options={categoryOptions}
              />
            </div>
          )}
          <div className={styles.meta}>
            <label>
              {kind === 'transfer'
                ? tr('转出账户')
                : kind === 'income' || kind === 'refund'
                  ? tr('实际到账账户')
                  : tr('实际扣款账户')}
              {badge('accountId')}
              <VisualSelect
                label={tr('资金账户')}
                value={account}
                onChange={v => {
                  mark('accountId');
                  setAccount(v);
                  setWalletNotice('');
                }}
                options={accounts
                  .filter(a => !repaying || a.type !== 'credit')
                  .map(a => ({
                    value: a.id,
                    label: accountLabel(a),
                    account: true,
                    accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                  }))}
              />
            </label>
            <div className={styles.when}>
              {' '}
              <label>
                {kind === 'refund' ? tr('退款到账日') : tr('交易日期')}
                {badge('date')}
                <DateField
                  type="date"
                  required
                  value={date}
                  onChange={value => {
                    mark('date');
                    setDate(value);
                  }}
                />
              </label>
              <label>
                {tr('交易时间（选填）')}
                {badge('occurredAt')}
                <input
                  type="time"
                  step="1"
                  value={normalizeTransactionTime(occurredAt)}
                  onChange={e => {
                    mark('occurredAt');
                    setOccurredAt(e.target.value);
                  }}
                />
              </label>
            </div>
            <label>
              {tr('记入账本')}
              <VisualSelect
                label={tr('记入账本')}
                value={destination}
                disabled={busy}
                onChange={next => {
                  setDestination(next);
                  if (kind === 'refund') setRefund('');
                }}
                options={books
                  .filter(b => b.role !== 'viewer')
                  .map(b => ({
                    value: b.id,
                    label: b.name + ' · ' + tr(b.kind === 'shared' ? '共享账本' : '个人账本'),
                    icon: b.icon,
                  }))}
              />
            </label>
            {kind === 'transfer' && (
              <label>
                {repaying ? tr('要还款的信用账户') : tr('转入账户')}
                <VisualSelect
                  label={tr('请选择转入账户')}
                  value={target}
                  onChange={setTarget}
                  options={accounts
                    .filter(a => a.id !== account && (!repaying || a.type === 'credit'))
                    .map(a => ({
                      value: a.id,
                      label: accountLabel(a),
                      account: true,
                      accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                    }))}
                />
              </label>
            )}
            {kind === 'refund' && (
              <RefundPicker
                books={books}
                onSelect={row => fillFromOriginal(row)}
                book={destination}
                value={refund}
                onChange={setRefund}
                exclude={initial?.id || reviewDraft?.id}
                local={localDrafts?.filter(
                  d => d.kind === 'expense' && d.action !== 'skip' && (d.targetBook || book) === destination,
                )}
                amount={(() => {
                  try {
                    return amount ? amountToCents(amount) : undefined;
                  } catch {
                    return undefined;
                  }
                })()}
                onAmountChange={cents => setAmount(String(cents / 100))}
              />
            )}
            {kind === 'expense' &&
              (!initial || (claimInfo?.canInvite && claimInfo.claim?.status !== 'accepted')) && (
                <ClaimRecipientSelect
                  familyId={accounts.find(a => a.id === account)?.family_id}
                  value={claimRecipient}
                  onChange={setClaimRecipient}
                  disabled={busy}
                />
              )}
          </div>
          {walletNotice && (
            <small className={styles.notice} role="status">
              {tr(walletNotice)}
            </small>
          )}
          {destination !== book && (
            <p className={styles.muted}>
              {tr(
                initial
                  ? '保存修改时同时移动到账本，实际收付款账户不变。'
                  : '保存到所选账本，使用下方的实际收付款账户。',
              )}
              {(kind === 'refund' || initial?.kind === 'expense') && (
                <span>
                  {tr(initial ? '关联的原消费与退款一起移动。' : '退款记入原单所在账本，原消费不移动。')}
                </span>
              )}
            </p>
          )}

          {kind === 'expense' && initial && claimInfo?.claim?.status === 'accepted' && (
            <p className={styles.muted}>
              {tr('这笔消费已由{0}认领。如需更换对象，请先在账单详情中撤回认领邀请。', [
                claimInfo.claim.recipient_name,
              ])}
            </p>
          )}
          {initial?.kind === 'expense' && claimLoadError && (
            <p className={styles.error} role="alert">
              {claimLoadError}{' '}
              <Button type="button" variant="ghost" size="sm" onClick={() => setClaimRetry(v => v + 1)}>
                {tr('重试加载消费对象')}
              </Button>
            </p>
          )}
        </div>
        <div className={styles.extras}>
          <div className={styles.extrasHead}>
            <strong>{tr('补充信息')}</strong>
            <small>{tr('都可以不填；需要时点开一项')}</small>
          </div>
          <div className={styles.extraChips}>
            {extras
              .filter(x => !openExtras.has(x.key))
              .map(x => (
                <button
                  type="button"
                  key={x.key}
                  className={styles.extraChip}
                  data-filled={x.summary ? true : undefined}
                  aria-expanded={false}
                  onClick={() => toggleExtra(x.key)}
                >
                  <Plus size={15} aria-hidden="true" />
                  {tr(x.label)}
                  {x.summary && <small>{x.summary}</small>}
                </button>
              ))}
          </div>
          {extras
            .filter(x => openExtras.has(x.key))
            .map(x => (
              <section key={x.key} className={styles.extra} aria-label={tr(x.label)}>
                <header>
                  <strong>{tr(x.label)}</strong>
                  <button
                    type="button"
                    className={styles.collapse}
                    aria-expanded
                    aria-label={tr('收起{0}', [tr(x.label)])}
                    onClick={() => toggleExtra(x.key)}
                  >
                    <ChevronUp size={18} />
                  </button>
                </header>
                {x.key === 'merchant' && (
                  <>
                    <label>
                      {kind === 'income' ? tr('收入来源 / 付款方') : tr('商家 / 交易对方')}
                      {badge('payee')}
                      <input
                        value={payee}
                        maxLength={120}
                        placeholder={tr('选填，例如：楼下便利店')}
                        onChange={e => {
                          mark('payee');
                          setPayee(e.target.value);
                        }}
                      />
                    </label>
                    <label>
                      {tr('商城 / 平台')}
                      {badge('platform')}
                      <input
                        value={platform}
                        maxLength={40}
                        onChange={e => {
                          mark('platform');
                          setPlatform(e.target.value);
                        }}
                      />
                    </label>
                    <label>
                      {tr('商品摘要')}
                      {badge('product')}
                      <textarea
                        className={styles.productSummary}
                        rows={2}
                        value={product}
                        maxLength={160}
                        onChange={e => {
                          mark('product');
                          setProduct(e.target.value);
                        }}
                      />
                    </label>
                  </>
                )}
                {x.key === 'items' && (
                  <>
                    {badge('lineItems')}
                    <LineItemsEditor
                      bare
                      category={category}
                      categories={categories}
                      items={lineItems}
                      onChange={items => {
                        mark('lineItems');
                        setLineItems(items);
                      }}
                      total={Number(amount) ? Math.round(Number(amount) * 100) : 0}
                      onTotal={n => setAmount(String(n / 100))}
                      book={book}
                      onRecognized={d => {
                        setChanged(old => {
                          const next = new Set(old);
                          next.delete('lineItems');
                          return next;
                        });
                        const received = new Set<keyof Draft>();
                        const fill = (
                          key: keyof Draft,
                          value: string | undefined,
                          setter: (s: string) => void,
                        ) => {
                          if (
                            !changed.has(key) &&
                            value &&
                            (filled.has(key) ||
                              !seed?.[key] ||
                              (key === 'accountId' && !initial && !reviewDraft))
                          ) {
                            setter(value);
                            received.add(key);
                          }
                        };
                        fill('title', d.title || d.payee, setTitle);
                        fill('payee', d.payee, setPayee);
                        fill('platform', d.platform, setPlatform);
                        fill('orderId', d.orderId, setOrderId);
                        fill('externalId', d.externalId, setExternalId);
                        fill('accountId', d.accountId, setAccount);
                        setFilled(old => new Set([...old, ...received, 'lineItems']));
                        if (received.has('accountId')) {
                          setWalletNotice(
                            d.walletMatch === 'channel'
                              ? '已按支付渠道自动选择，请核对是否为实际扣款账户。'
                              : '已根据明确扣款信息自动选择。',
                          );
                        } else if ((d.walletCandidates?.length || 0) > 1)
                          setWalletNotice('找到多个符合付款信息的钱包，请选择实际扣款账户。');
                      }}
                      onBusyChange={setRecognizing}
                      onAttachments={ids => setAttachmentIds(v => Array.from(new Set([...v, ...ids])))}
                    />
                    <VerificationConfirm
                      items={lineItems}
                      total={Math.round(Number(amount) * 100)}
                      value={verificationReason}
                      onChange={setVerificationReason}
                    />
                    {!!attachmentIds.length && (
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={retainReceipts}
                          onChange={e => setRetainReceipts(e.target.checked)}
                        />
                        {tr('保存本次上传的图片凭证（')}
                        {attachmentIds.length}
                        {tr('张）')}
                      </label>
                    )}
                  </>
                )}
                {x.key === 'scene' && (
                  <SceneFields
                    value={scene}
                    onChange={(value, title) => {
                      setScene(value);
                      if (title) {
                        mark('title');
                        setTitle(title);
                      }
                    }}
                  />
                )}
                {x.key === 'note' && (
                  <label>
                    {tr('备注')}
                    {badge('note')}
                    <textarea
                      rows={2}
                      value={note}
                      maxLength={2000}
                      placeholder={tr('记一点这笔钱的小故事')}
                      onChange={e => {
                        mark('note');
                        setNote(e.target.value);
                      }}
                    />
                  </label>
                )}
                {x.key === 'order' && (
                  <>
                    <label>
                      {tr('订单号（选填）')}
                      {badge('orderId')}
                      <input
                        value={orderId}
                        maxLength={200}
                        autoComplete="off"
                        onChange={e => {
                          mark('orderId');
                          setOrderId(e.target.value);
                        }}
                      />
                    </label>
                    <label>
                      {tr('交易 / 退款流水号（选填）')}
                      {badge('externalId')}
                      <input
                        value={externalId}
                        maxLength={200}
                        autoComplete="off"
                        onChange={e => {
                          mark('externalId');
                          setExternalId(e.target.value);
                        }}
                      />
                    </label>
                    <small className={styles.muted}>
                      {tr('编号不是必填项；图片中清晰可见时会自动带入，并用于以后核对账单。')}
                    </small>
                  </>
                )}
                {x.key === 'activity' && (
                  <ActivitySelect
                    value={activityId}
                    onChange={setActivityId}
                    disabled={busy || !activityLoaded}
                  />
                )}
                {x.key === 'installment' && (
                  <EntryInstallmentFields
                    value={installment}
                    onChange={setInstallment}
                    credit={accounts.some(a => a.id === account && a.type === 'credit')}
                  />
                )}
                {x.key === 'photos' && (
                  <TransactionPhotos
                    book={book}
                    ids={photoIds}
                    onChange={setPhotoIds}
                    disabled={busy}
                    onBusy={setPhotoBusy}
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      )}
      {!openExtras.has('items') && !!attachmentIds.length && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={retainReceipts}
            onChange={e => setRetainReceipts(e.target.checked)}
          />
          {tr('保存本次上传的图片凭证（')}
          {attachmentIds.length}
          {tr('张）')}
        </label>
      )}
      {!openExtras.has('items') && (
        <VerificationConfirm
          items={lineItems}
          total={Number(amount) ? Math.round(Number(amount) * 100) : 0}
          value={verificationReason}
          onChange={setVerificationReason}
        />
      )}
      {error && (
        <p className={styles.error} role="alert">
          {tr(error)}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy || recognizing || photoBusy}>
          {busy ? tr('正在保存…') : initial || reviewDraft ? tr('保存修改') : tr('保存')}
        </Button>
        {!initial && !reviewDraft && (
          <Button type="submit" value="again" disabled={busy || recognizing || photoBusy}>
            {tr('保存并再记')}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {initial ? tr('取消修改') : tr('取消')}
        </Button>
      </div>
    </form>
  );
}
