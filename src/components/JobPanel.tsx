'use client';
import { Button, Card, ListRow, Input, Sheet } from '@/ui';
import styles from './JobPanel.module.css';
import { PagedList } from './PagedList';

import { getLocale } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';
import { useEffect, useState } from 'react';
import { ListTodo, LoaderCircle, CheckCircle2, XCircle } from 'lucide-react';
import { FinanceNarrative } from './FinanceNarrative';
import type { Draft } from './DraftReview';
type Job = {
  id: string;
  kind: string;
  status: string;
  stage: string;
  error: string;
  book_id: string;
  book_name: string;
  created_at: string;
  result?: any;
};
async function request(path: string, body?: unknown) {
  const r = await fetch('/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export function JobPanel({
  book,
  onDrafts,
}: {
  book: string;
  onDrafts: (drafts: Draft[], bookId?: string) => void;
}) {
  const { t: tr, locale } = useI18n();
  const [jobs, setJobs] = useState<Job[]>([]),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState<Job | null>(null),
    [error, setError] = useState('');
  async function refresh() {
    setJobs(await request('jobs'));
  }
  useEffect(() => {
    let alive = true;
    const load = () =>
      request('jobs')
        .then(j => {
          if (alive) setJobs(j);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  async function openResult(id: string) {
    setError('');
    const job = await request('jobs/' + id);
    if (job.kind === 'assistant' && job.result?.entries?.length) {
      onDrafts(job.result.entries, job.book_id);
      setSelected(null);
      setOpen(false);
    } else setSelected(job);
  }
  const count = jobs.filter(j => ['queued', 'running'].includes(j.status)).length;
  return (
    <>
      <Button
        className={styles.taskTrigger}
        aria-label={tr('后台任务{0}', [count ? tr('，{0}个处理中', [count]) : tr('暂无进行中的任务')])}
        onClick={() => {
          setOpen(true);
          refresh().catch(e => setError(e.message));
        }}
      >
        <ListTodo size={18} />
        <span className={styles.taskLabel}>{tr('后台任务')}</span>
        {count > 0 && <span className={styles.taskCount}>{count}</span>}
      </Button>
      {open && (
        <Sheet open closeLabel={tr('关闭弹窗')} title={tr('后台任务')} onClose={() => setOpen(false)}>
          <p className={styles.muted}>{tr('关闭网页后继续处理，结果保存在这里。')}</p>
          {error && <p className={styles.error}>{tr(error)}</p>}
          <div className={styles.jobList}>
            {!jobs.length && <p>{tr('暂无任务')}</p>}
            {
              <PagedList items={jobs}>
                {j => (
                  <Card as="article" className={styles.jobCard} key={j.id}>
                    <div className={styles.panelTitle}>
                      <strong>
                        {j.status === 'running' ? (
                          <LoaderCircle className={styles.spinning} size={17} />
                        ) : j.status === 'complete' ? (
                          <CheckCircle2 size={17} />
                        ) : j.status === 'error' ? (
                          <XCircle size={17} />
                        ) : (
                          <ListTodo size={17} />
                        )}{' '}
                        {tr(
                          (
                            {
                              assistant: '账单识别',
                              chat: '财务对话',
                              connection: '连接测试',
                              memory: '记忆整理',
                            } as any
                          )[j.kind],
                        )}
                      </strong>
                      <small>
                        {tr(
                          (
                            {
                              queued: '排队中',
                              running: '处理中',
                              complete: '已完成',
                              error: '未完成',
                              cancelled: '已取消',
                            } as any
                          )[j.status],
                        )}
                      </small>
                    </div>
                    <p>{tr(j.stage)}</p>
                    {j.status === 'running' && (
                      <progress className={styles.progress} aria-label={tr(j.stage)} />
                    )}
                    <small>
                      {j.book_name || tr('系统设置')} · {new Date(j.created_at).toLocaleString(getLocale())}
                    </small>
                    <div className={styles.inline}>
                      {['error', 'cancelled'].includes(j.status) && (
                        <Button
                          onClick={() =>
                            request('jobs/' + j.id, { operation: 'retry' })
                              .then(refresh)
                              .catch(e => setError(e.message))
                          }
                        >
                          {j.kind === 'chat' ? tr('重新生成回答') : tr('从已完成进度重试')}
                        </Button>
                      )}
                      {['queued', 'running'].includes(j.status) ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            request('jobs/' + j.id, { operation: 'cancel' })
                              .then(refresh)
                              .catch(e => setError(e.message))
                          }
                        >
                          {tr('取消任务')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => openResult(j.id).catch(e => setError(e.message))}
                        >
                          {tr('查看结果')}
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
              </PagedList>
            }
          </div>
        </Sheet>
      )}
      {selected && (
        <Sheet open closeLabel={tr('关闭弹窗')} title={tr('任务结果')} onClose={() => setSelected(null)}>
          {error && <p className={styles.error}>{tr(error)}</p>}
          {selected.error && <p className={styles.error}>{tr(selected.error)}</p>}
          {selected.kind === 'chat' && selected.result && (
            <FinanceNarrative text={selected.result.text} artifacts={selected.result.artifacts} />
          )}
          {selected.kind === 'assistant' &&
            selected.status === 'complete' &&
            !selected.result?.entries?.length &&
            !selected.result?.ignored?.length && (
              <>
                <p className={styles.notice}>
                  {tr('这次没有生成可编辑草稿。原图仍保留，可以重新识别；也可以重新上传清晰账单。')}
                </p>
                <Button
                  variant="primary"
                  onClick={() =>
                    request('jobs/' + selected.id, { operation: 'retry' })
                      .then(() => {
                        setSelected(null);
                        return refresh();
                      })
                      .catch(e => setError(e.message))
                  }
                >
                  {tr('重新识别图片')}
                </Button>
              </>
            )}
          <p>
            {selected.result?.message ||
              (!selected.error && selected.kind === 'connection' ? '模型连接成功' : '')}
          </p>
          {(selected.result?.entries || selected.result?.artifacts?.drafts)?.length > 0 && (
            <>
              <p>
                {tr('共')}
                {(selected.result.entries || selected.result.artifacts.drafts).length} {tr('笔待确认草稿')}
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  try {
                    onDrafts(selected.result.entries || selected.result.artifacts.drafts, selected.book_id);
                    setSelected(null);
                    setOpen(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {tr('打开草稿核对')}
              </Button>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
export function QueueSettings() {
  const { t: tr, locale } = useI18n();
  const [n, setN] = useState(2),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    request('queue-settings')
      .then(d => setN(d.concurrency))
      .catch(e => setMessage(e.message));
  }, []);
  return (
    <Card>
      <ListRow
        title={tr('后台任务')}
        meta={tr('同时处理的任务数')}
        end={<>{n} ›</>}
        onClick={() => {
          setMessage('');
          setOpen(true);
        }}
      />
      <Sheet
        open={open}
        title={tr('后台任务')}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <form
          onSubmit={async e => {
            e.preventDefault();
            const concurrency = Number(new FormData(e.currentTarget).get('concurrency'));
            setBusy(true);
            try {
              const r = await fetch('/api/queue-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concurrency }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setN(concurrency);
              setMessage('并发数量已更新');
              setOpen(false);
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {tr('同时处理的任务数')}
            <Input type="number" min={1} max={8} step={1} name="concurrency" defaultValue={n} required />
          </label>
          <Button type="submit" variant="primary" disabled={busy}>
            {tr('保存并发设置')}
          </Button>
          {message && <p role="status">{tr(message)}</p>}
        </form>
      </Sheet>
      {!open && message && <p role="status">{tr(message)}</p>}
    </Card>
  );
}
