'use client';
import { Button, ConfirmDialog } from '@/ui';
import styles from './WalletEntryActions.module.css';
import { useEffect, useState } from 'react';
import { useI18n } from './LanguageProvider';
export function WalletEntryActions({ id, onDeleted }: { id: string; onDeleted: () => Promise<void> }) {
  const { t: tr } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError('');
    fetch('/api/assets/funds/entry?id=' + encodeURIComponent(id), { signal: c.signal })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!c.signal.aborted) setData(d);
      })
      .catch(e => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, retry]);
  async function remove() {
    if (busy || !data?.canDelete) return;
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/assets/funds/entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, expected: data.expected }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await onDeleted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.actions}>
      {!data && !error && (
        <p className={styles.muted} role="status">
          {tr('正在读取流水操作…')}
        </p>
      )}
      {data?.canDelete && (
        <>
          <p className={styles.muted}>
            {tr(
              '多记或重复的流水可在这里删除，并重新计算相关钱包余额。关联账本记录一起移入回收站，不只是隐藏当前列表。',
            )}
          </p>
          <Button type="button" disabled={busy} onClick={() => setConfirming(true)}>
            {busy ? tr('正在删除…') : tr('删除这笔流水')}
          </Button>
          {confirming && (
            <ConfirmDialog
              open
              title={tr('删除这笔流水')}
              confirmLabel={tr('删除这笔流水')}
              onCancel={() => setConfirming(false)}
              onConfirm={() => void remove()}
            >
              <p>{tr('涉及钱包的余额会重新计算，不会撤销银行或支付平台的真实交易。')}</p>
              {data.copies > 1 && <p>{tr('它在 {0} 个账本中的关联记录将一起移入回收站。', [data.copies])}</p>}
            </ConfirmDialog>
          )}
        </>
      )}
      {data && !data.canDelete && <p className={styles.muted}>{tr(data.reason)}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {tr(error)}{' '}
          <Button type="button" variant="ghost" disabled={busy} onClick={() => setRetry(v => v + 1)}>
            {tr('重新读取')}
          </Button>
        </p>
      )}
    </section>
  );
}
