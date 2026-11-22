'use client';
import styles from './MemoryHistory.module.css';
import { Button } from '@/ui';
import { useConfirmation } from '@/ui/useConfirmation';
import { useI18n } from './LanguageProvider';
import { useEffect, useState } from 'react';
import {
  History,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Pencil,
  Trash2,
  GitMerge,
  Split,
  Share2,
  RefreshCw,
} from 'lucide-react';

type MemoryEvent = {
  id: string;
  operation: string;
  title: string | null;
  kind: string | null;
  created_at: string;
  can_undo: boolean;
};
const operations: Record<string, { label: string; icon: typeof Pencil }> = {
  save: { label: '编辑', icon: Pencil },
  status: { label: '变更状态', icon: RefreshCw },
  forget: { label: '遗忘', icon: Trash2 },
  merge: { label: '合并商品', icon: GitMerge },
  split: { label: '拆分商品', icon: Split },
  share: { label: '共享', icon: Share2 },
  undo: { label: '撤销', icon: Undo2 },
};
const kinds: Record<string, string> = {
  product: '商品与服务',
  preference: '记账偏好',
  subscription: '订阅',
  activity: '活动',
  conversation: '对话记忆',
  todo: '待办',
  negative: '排除的关联',
};
export function MemoryHistory() {
  const { t: tr, locale } = useI18n();
  const { confirmation, requestConfirmation } = useConfirmation();
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<{ items: MemoryEvent[]; total: number }>({ items: [], total: 0 }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch('/api/memories?events&page=' + page)
      .then(async r => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error || tr('记录加载失败'));
        return value;
      })
      .then(value => {
        if (active) setData(value);
      })
      .catch(e => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  async function undo(event: MemoryEvent) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'undo', eventId: event.id }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || tr('撤销失败'));
      setMessage(tr('已撤销，记忆已恢复到此次变更前。'));
      setRevision(v => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`memory-history ${styles.memoryHistory}`}
      aria-labelledby="memory-history-title"
      aria-busy={loading}
    >
      {confirmation}
      <header className={styles.memoryHistoryHeading}>
        <div>
          <h3 id="memory-history-title">{tr('变更记录')}</h3>
          <p>{tr('追踪记忆的调整，不影响原始账单。')}</p>
        </div>
        <span className={styles.memoryHistoryCount}>
          {tr('共 ')}
          {data.total} {tr(' 条记录')}
        </span>
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          <Button
            variant="ghost"
            type="button"
            disabled={loading || busy}
            onClick={() => setRevision(v => v + 1)}
          >
            {tr('刷新记录')}
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {loading ? (
        <div className={styles.memoryHistoryEmpty} role="status">
          <History size={28} aria-hidden="true" />
          <p>{tr('正在加载变更记录…')}</p>
        </div>
      ) : !data.items.length ? (
        <div className={styles.memoryHistoryEmpty}>
          <History size={32} aria-hidden="true" />
          <h4>{tr('还没有变更记录')}</h4>
          <p>{tr('编辑、停用或共享记忆后，可在这里查看记录。')}</p>
        </div>
      ) : (
        <>
          <div className={styles.memoryHistoryColumns} aria-hidden="true">
            <span>{tr('操作与记忆')}</span>
            <span>{tr('变更时间')}</span>
            <span>{tr('操作状态')}</span>
          </div>
          <ol className={styles.memoryHistoryList}>
            {data.items.map(event => {
              const op = operations[event.operation] || { label: event.operation, icon: History };
              const Icon = op.icon;
              const date = new Date(event.created_at);
              return (
                <li key={event.id} className={`memory-history-row ${styles.memoryHistoryRow}`}>
                  <div className={styles.memoryHistoryObject}>
                    <span className={styles.memoryEventIcon} data-forgotten={event.operation === 'forget'}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <span className={styles.memoryEventLabel}>
                        {tr(op.label)}
                        {event.kind && <span> · {tr(kinds[event.kind] || event.kind)}</span>}
                      </span>
                      <strong>{event.title || tr('已遗忘或不可访问的记忆')}</strong>
                      {!event.title && <small>{tr('不再展示记忆内容')}</small>}
                    </div>
                  </div>
                  <time dateTime={event.created_at}>
                    <span>
                      {date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                    <small>{date.toLocaleTimeString(locale, { hour12: false })}</small>
                  </time>
                  <div className={styles.memoryEventAction}>
                    {event.can_undo ? (
                      <Button
                        type="button"
                        disabled={busy || loading}
                        onClick={() =>
                          requestConfirmation(
                            tr('撤销这次变更？将恢复这条记忆之前的内容，原账单不受影响。'),
                            () => undo(event),
                          )
                        }
                      >
                        <Undo2 size={15} aria-hidden="true" />
                        {tr('撤销变更')}
                      </Button>
                    ) : (
                      <span>
                        {event.operation === 'forget'
                          ? tr('已遗忘')
                          : event.operation === 'undo'
                            ? tr('已撤销')
                            : ['save', 'status'].includes(event.operation)
                              ? tr('不可撤销')
                              : tr('已完成')}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <footer className={styles.memoryHistoryPagination}>
        <span>
          {data.total
            ? tr('{0}–{1} / {2} 条', [(page - 1) * 20 + 1, Math.min(page * 20, data.total), data.total])
            : tr('0 条记录')}
        </span>
        <nav aria-label={tr('变更记录分页')}>
          <Button
            type="button"
            aria-label={tr('上一页记录')}
            disabled={loading || busy || page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <span>
            {page} / {Math.max(1, Math.ceil(data.total / 20))}
          </span>
          <Button
            type="button"
            aria-label={tr('下一页记录')}
            disabled={loading || busy || page * 20 >= data.total}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </nav>
      </footer>
    </section>
  );
}
