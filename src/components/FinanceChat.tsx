'use client';
import { Button, Chip, ConfirmDialog, Input, ListRow, Sheet, TextArea } from '@/ui';
import styles from './FinanceChat.module.css';
import { chatVisibleText } from '@/lib/chat-visible-text';
import { ProfileLocation } from './ProfileLocation';
import type { ProfileContext } from '@/lib/personal-profile';
import { PagedList } from './PagedList';

import { placeChatCards } from '@/lib/chat-card-placement';
import { FinanceComposer } from './FinanceComposer';
import type { ChatAction } from '@/lib/chat-actions';
import { ChatActionCards } from './ChatActionCards';
import { deviceDateTime } from '@/lib/entry-time';
import { getLocale } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';
import { updateThinking } from '@/lib/thinking';
import { useTheme } from './ThemeProvider';
import { themes } from '@/lib/themes';
import { useEffect, useRef, useState } from 'react';
import { Plus, FileText, MessagesSquare, Download, Trash2, Pencil, History, Images } from 'lucide-react';
import { readEvents } from '@/lib/events';
import { FinanceNarrative } from './FinanceNarrative';
import type { AgentArtifact } from '@/server/finance-agent';
import type { Draft } from './DraftReview';
type Turn = {
  id: string;
  question: string;
  answer: string;
  artifacts: AgentArtifact;
  status: string;
  error: string;
  model: string;
  created_at?: string;
};
type ActionLog = {
  id: string;
  title: string;
  created_at: string;
  status: 'success' | 'failed' | 'undone';
  canUndo: boolean;
};
async function actionRecords(query: string): Promise<ActionLog[]> {
  const response = await fetch('/api/assistant-actions?' + query);
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value;
}
type Report = {
  id: string;
  title: string;
  content: string;
  artifacts: AgentArtifact;
  model: string;
  version: number;
  created_at: string;
};
async function api(book: string, body?: unknown, id?: string) {
  const r = await fetch(`/api/books/${book}/chat${id ? '?id=' + id : ''}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
function QueryScope({ books }: { books: AgentArtifact['analysisBooks'] }) {
  const { t: tr } = useI18n();
  const names = books
    ?.map(book => book?.name?.trim())
    .filter(Boolean)
    .join('、');
  return names ? (
    <small className={styles.financeQuestionAttachments}>
      {tr('查询范围')}：{names}
    </small>
  ) : null;
}
function requestUUID() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function toolScope(args: unknown) {
  const a = (args || {}) as Record<string, unknown>;
  return [
    ['from', '开始'],
    ['to', '结束'],
    ['month', '月份'],
    ['query', '关键词'],
    ['category', '分类'],
    ['title', '图表'],
  ]
    .filter(([key]) => a[key])
    .map(([key, label]) => label + '：' + String(a[key]))
    .join(' · ');
}
const empty = (): AgentArtifact => ({ charts: [], tools: [], drafts: [] });
export function FinanceChat({
  onNavigate,
  books,
  book,
  month,
  canWrite,
  onDrafts,
  onChanged,
  initialTarget,
  onTargetOpened,
  initialPrompt,
  onPromptOpened,
}: {
  onNavigate?: (page: string) => void;
  books: { id: string; name: string }[];
  onChanged?: () => Promise<unknown>;
  initialTarget?: { id: string; entity: string };
  onTargetOpened?: () => void;
  initialPrompt?: { id: string; text: string; source?: 'help' };
  onPromptOpened?: () => void;
  book: string;
  month: string;
  canWrite: boolean;
  onDrafts: (d: Draft[]) => void;
}) {
  const { t: tr, locale } = useI18n();
  const { theme } = useTheme();
  const [profileContext, setProfileContext] = useState<ProfileContext>();
  const [useHistory, setUseHistory] = useState(true),
    [uploading, setUploading] = useState(false),
    [showLatest, setShowLatest] = useState(false);
  const [list, setList] = useState<{ id: string; title: string; updated_at: string }[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [id, setId] = useState(''),
    [turns, setTurns] = useState<Turn[]>([]),
    [report, setReport] = useState<Report | null>(null),
    [tab, setTab] = useState('chat'),
    [text, setText] = useState(''),
    [images, setImages] = useState<{ name: string; data: string }[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [edit, setEdit] = useState(false),
    [rename, setRename] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<{
      kind: 'report' | 'chat';
      id: string;
      title: string;
      version?: number;
    } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [replyAction, setReplyAction] = useState<ChatAction | null>(null);
  const [history, setHistory] = useState<ActionLog[]>([]);
  const [undoId, setUndoId] = useState('');
  const [undoBusy, setUndoBusy] = useState(false);
  const [undone, setUndone] = useState(new Set<string>());
  const [revision, setRevision] = useState(0);
  const cardIds = [
    ...new Set(
      turns.flatMap(turn =>
        (turn.artifacts?.actions || []).flatMap(card =>
          card.canUndo && card.actionLogId ? [card.actionLogId] : [],
        ),
      ),
    ),
  ].join(',');
  useEffect(() => {
    if (!cardIds) return;
    let active = true;
    const ids = cardIds.split(',');
    const requests = [];
    for (let i = 0; i < ids.length; i += 50)
      requests.push(actionRecords('ids=' + ids.slice(i, i + 50).join(',')));
    Promise.all(requests)
      .then(pages => {
        if (active)
          setUndone(
            new Set(
              pages
                .flat()
                .filter(row => row.status === 'undone')
                .map(row => row.id),
            ),
          );
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [cardIds, revision]);
  useEffect(() => {
    if (tab !== 'actions') return;
    let active = true;
    actionRecords('limit=50')
      .then(rows => {
        if (active) setHistory(rows);
      })
      .catch(e => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [tab, busy, revision, turns.length, cardIds]);
  async function undoAction() {
    if (!undoId || undoBusy) return;
    setUndoBusy(true);
    try {
      const response = await fetch('/api/assistant-actions/' + undoId + '/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setUndone(old => new Set([...old, undoId]));
      setRevision(n => n + 1);
      await onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUndoBusy(false);
      setUndoId('');
    }
  }
  const activeTask = useRef('');
  const abort = useRef<AbortController | null>(null),
    bodyRef = useRef<HTMLDivElement>(null),
    messageContent = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    conversation = useRef(id);
  conversation.current = id;
  async function refresh() {
    const d = await api(book);
    setList(d.conversations);
    setReports(d.reports);
  }
  async function load(next: string) {
    setError('');
    setReplyAction(null);
    try {
      const d = await api(book, undefined, next);
      setId(next);
      setTurns(d.turns);
      setReport(null);
      setTab('chat');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh().catch(e => setError(e.message));
    return () => abort.current?.abort();
  }, [book]);
  useEffect(() => {
    if (!initialTarget || !['report', 'conversation'].includes(initialTarget.entity)) return;
    let alive = true;
    abort.current?.abort();
    api(book, undefined, initialTarget.entity === 'conversation' ? initialTarget.id : undefined)
      .then(d => {
        if (!alive) return;
        if (initialTarget.entity === 'conversation') {
          setId(initialTarget.id);
          setTurns(d.turns);
          setReport(null);
          setTab('chat');
        } else {
          const r = d.reports.find((r: Report) => r.id === initialTarget.id);
          if (!r) throw new Error('报告已删除或没有访问权限');
          setReport(r);
          setTab('reports');
        }
        onTargetOpened?.();
      })
      .catch(e => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [book, initialTarget?.id]);
  useEffect(() => {
    if (!initialPrompt) return;
    setReport(null);
    setTab('chat');
    setText(tr(initialPrompt.text));
    setNotice(
      initialPrompt.source === 'help'
        ? tr('已带入说明主题，请补充问题后发送。')
        : tr('请上传需要核对的支付账单截图，然后发送消息。'),
    );
    onPromptOpened?.();
    requestAnimationFrame(() => bodyRef.current?.parentElement?.querySelector('textarea')?.focus());
  }, [initialPrompt?.id]);
  useEffect(() => {
    const messages = bodyRef.current,
      content = messageContent.current;
    if (!messages || !content) return;
    const update = () => {
      const remaining = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
      nearBottom.current = remaining < 100;
      setShowLatest(remaining > messages.clientHeight);
    };
    const observer = new ResizeObserver(update);
    observer.observe(messages);
    observer.observe(content);
    messages.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      messages.removeEventListener('scroll', update);
    };
  }, []);
  useEffect(() => {
    if (nearBottom.current) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [turns, status]);
  useEffect(() => {
    if (!id || busy) return;
    let alive = true;
    const t = setInterval(
      () =>
        api(book, undefined, id)
          .then(d => {
            if (alive) setTurns(d.turns);
          })
          .catch(() => {}),
      2000,
    );
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [book, id, busy]);
  const appliedActions = turns
    .flatMap(t =>
      (t.artifacts.actions || [])
        .filter(a => a.executedBy === 'assistant' && a.status === 'confirmed')
        .map(a => a.id),
    )
    .sort()
    .join(',');
  const appliedSeen = useRef('');
  useEffect(() => {
    if (appliedSeen.current === appliedActions) return;
    appliedSeen.current = appliedActions;
    if (appliedActions) void onChanged?.();
  }, [appliedActions, onChanged]);
  async function send(prompt = text) {
    if (busy || uploading || turns.some(t => t.status === 'running') || (!prompt.trim() && !images.length))
      return;
    setError('');
    setNotice('');
    setBusy(true);
    setReport(null);
    setTab('chat');
    const controller = new AbortController();
    abort.current = controller;
    let current = id,
      persisted = false,
      done = false;
    const requestId = requestUUID(),
      question = prompt || tr('请识别附图账单'),
      outgoingImages = images.map(i => i.data);
    activeTask.current = requestId;
    try {
      if (!current) {
        current = (await api(book, { operation: 'create' })).id;
        setId(current);
      }
      setTurns(v => [
        ...v,
        {
          id: requestId,
          question,
          answer: '',
          artifacts: { ...empty(), images: outgoingImages },
          status: 'running',
          error: '',
          model: '',
        },
      ]);
      nearBottom.current = true;
      const saved = await fetch(`/api/books/${book}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileContext: useHistory ? profileContext : undefined,
          deviceTime: deviceDateTime(),
          useHistory,
          operation: 'send',
          actionId: replyAction?.id,
          id: current,
          requestId,
          text: prompt,
          month,
          images: outgoingImages,
          background: true,
        }),
      });
      const savedBody = await saved.json();
      if (!saved.ok) throw new Error(savedBody.error || '消息未发送，请重试');
      persisted = true;
      setProfileContext(undefined);
      setText('');
      setImages([]);
      setReplyAction(null);
      setNotice('消息已保存，切换页面后助手仍会继续处理。');
      await refresh();
      const response = await fetch(`/api/jobs/${savedBody.jobId || requestId}?stream=1`, {
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const e = await response.json();
        throw new Error(e.error || '连接失败');
      }
      await readEvents(response.body, raw => {
        const event = JSON.parse(raw);
        if (event.event === 'thinking') {
          setStatus(event.data.status === 'running' ? event.data.label + '正在思考' : '正在整理回答');
          setTurns(v =>
            v.map(t =>
              t.id === requestId
                ? {
                    ...t,
                    artifacts: { ...t.artifacts, thinking: updateThinking(t.artifacts.thinking, event.data) },
                  }
                : t,
            ),
          );
        }
        if (event.event === 'delta')
          setTurns(v => v.map(t => (t.id === requestId ? { ...t, answer: t.answer + event.data } : t)));
        if (event.event === 'status') setStatus(event.data);
        if (event.event === 'tool_start') setStatus(event.data.label + '…');
        if (event.event === 'agent_start' || event.event === 'agent_done') {
          setStatus(event.data.role + (event.event === 'agent_start' ? '正在处理' : '已返回结果'));
          setTurns(v => v.map(t => (t.id === requestId ? { ...t, artifacts: event.data.artifacts } : t)));
        }
        if (event.event === 'tool_result')
          setTurns(v => v.map(t => (t.id === requestId ? { ...t, artifacts: event.data.artifacts } : t)));
        if (event.event === 'error') throw new Error(event.data);
        if (event.event === 'done') {
          done = true;
          setNotice('');
          setTurns(v =>
            v.map(t =>
              t.id === requestId
                ? {
                    ...t,
                    answer: event.data.text,
                    artifacts: event.data.artifacts,
                    status: event.data.status,
                    error: event.data.error,
                    model: event.data.model,
                  }
                : t,
            ),
          );
        }
      });
      if (!done) throw new Error('连接中断，回答可能未完成；可重新打开对话读取已保存内容');
    } catch (e) {
      const message =
        controller.signal.aborted && persisted ? '消息已保存，助手正在后台继续处理' : (e as Error).message;
      if (persisted) {
        setNotice(message);
        setTurns(v => v.map(t => (t.id === requestId && t.status === 'running' ? { ...t, error: '' } : t)));
      } else {
        setError(message);
        setTurns(v => v.filter(t => t.id !== requestId));
      }
    } finally {
      setBusy(false);
      setStatus('');
      await refresh().catch(() => {});
    }
  }
  async function saveReport(t: Turn) {
    try {
      const d = await api(book, { operation: 'save_report', turnId: t.id, title: t.question.slice(0, 60) });
      await refresh();
      setNotice('已保存到报告，可在“报告”中查看和导出。');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function download(format: 'html' | 'md') {
    if (!report) return;
    const name = report.title.replace(/[\\/:*?"<>|]/g, '_'),
      escape = (s: string) =>
        s.replace(
          /[&<>"']/g,
          c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
        );
    const html = `<!doctype html><html lang="${locale}"><meta charset="utf-8"><title>${escape(report.title)}</title><style>body{font:16px/1.8 system-ui;max-width:1000px;margin:40px auto;padding:24px;color:CanvasText}table{border-collapse:collapse;width:100%}td,th{border:1px solid GrayText;padding:8px}figure{margin:24px 0}small{display:block;color:GrayText}svg{max-width:100%}pre{white-space:pre-wrap}@media print{details{display:block}}</style><h1>${escape(report.title)}</h1><p>${tr('保存时间：')}${escape(report.created_at)} ${tr('· 数据为保存时快照')}</p>${bodyRef.current?.querySelector('[data-report-body]')?.innerHTML || ''}</html>`;
    const md =
      chatVisibleText(report.content) +
      '\n\n' +
      tr('图表数据快照：') +
      '\n```json\n' +
      JSON.stringify(report.artifacts.charts, null, 2) +
      '\n```';
    const url = URL.createObjectURL(
      new Blob([format === 'html' ? html : md], {
        type: format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.' + format;
    a.click();
    URL.revokeObjectURL(url);
  }
  const cardsByTurn = placeChatCards(turns),
    latestTurn = turns.at(-1);
  const library = (
    <div className={styles.financeLibrary}>
      <div className={styles.panelTitle}>
        <h2>{tr(themes[theme].assistant)}</h2>
        <Button
          variant="ghost"
          title={tr('新对话')}
          aria-label={tr('新对话')}
          disabled={busy}
          onClick={() => {
            setId('');
            setTurns([]);
            setReplyAction(null);
            setReport(null);
            setTab('chat');
            setLibraryOpen(false);
          }}
        >
          <Plus size={20} />
        </Button>
      </div>
      <div className={styles.tabs}>
        <Button
          aria-pressed={tab === 'chat'}
          disabled={busy}
          onClick={() => {
            setTab('chat');
            setReport(null);
          }}
        >
          <MessagesSquare size={16} />
          {tr('对话')}
        </Button>
        <Button aria-pressed={tab === 'reports'} disabled={busy} onClick={() => setTab('reports')}>
          <FileText size={16} />
          {tr('报告')}
        </Button>
        <Button size="sm" aria-pressed={tab === 'actions'} onClick={() => setTab('actions')}>
          {tr('助手操作记录')}
        </Button>
      </div>
      <div className={styles.financeHistory}>
        {tab === 'actions' ? (
          history.length ? (
            history.map(row => (
              <ListRow
                key={row.id}
                title={tr(row.title)}
                meta={new Date(row.created_at).toLocaleString(getLocale())}
                leading={
                  <Chip>
                    {tr(row.status === 'undone' ? '已撤销' : row.status === 'failed' ? '失败' : '已执行')}
                  </Chip>
                }
                end={
                  row.canUndo ? (
                    <Button size="sm" disabled={undoBusy} onClick={() => setUndoId(row.id)}>
                      {tr('撤销')}
                    </Button>
                  ) : (
                    row.status !== 'undone' && tr('不可撤销')
                  )
                }
              />
            ))
          ) : (
            <p>{tr('暂无操作记录')}</p>
          )
        ) : (
          <PagedList<(typeof list)[number] | Report> items={tab === 'chat' ? list : reports} resetKey={tab}>
            {item => (
              <div className={styles.financeHistoryRow} key={item.id}>
                <Button
                  aria-pressed={tab === 'chat' ? item.id === id : item.id === report?.id}
                  disabled={busy}
                  onClick={() => {
                    if (tab === 'chat') load(item.id);
                    else setReport(item as Report);
                    setLibraryOpen(false);
                  }}
                >
                  <strong>{item.title}</strong>
                  <small>
                    {new Date('updated_at' in item ? item.updated_at : item.created_at).toLocaleDateString(
                      getLocale(),
                    )}
                  </small>
                </Button>
                <Button
                  className={styles.historyDelete}
                  disabled={busy}
                  title={tr(tab === 'chat' ? '删除对话' : '删除报告')}
                  aria-label={tr('删除') + ' ' + item.title}
                  onClick={() =>
                    setDeleteTarget({
                      kind: tab === 'chat' ? 'chat' : 'report',
                      id: item.id,
                      title: item.title,
                      version: 'version' in item ? item.version : undefined,
                    })
                  }
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            )}
          </PagedList>
        )}
      </div>
    </div>
  );
  return (
    <section className={styles.financeWorkspace}>
      <ConfirmDialog
        open={!!undoId}
        title={tr('撤销助手操作')}
        confirmLabel={tr('撤销')}
        busy={undoBusy}
        onConfirm={undoAction}
        onCancel={() => {
          if (!undoBusy) setUndoId('');
        }}
      >
        {tr('确认撤销这次账目变更？')}
      </ConfirmDialog>
      {libraryOpen && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={tr('对话与报告')}
          onClose={() => setLibraryOpen(false)}
        >
          {library}
        </Sheet>
      )}
      <div className={styles.financeMain}>
        <div className={styles.financeToolbar}>
          <Button
            className={styles.financeLibraryToggle}
            onClick={() => setLibraryOpen(true)}
            aria-label={tr('打开对话历史和报告')}
          >
            <History size={18} />
            {tr('历史 / 报告')}
          </Button>
          <span className={styles.financeConversationTitle}>
            {report ? report.title : list.find(c => c.id === id)?.title || tr(themes[theme].assistant)}
          </span>
          <div className={styles.financeToolbarActions}>
            <Button
              variant="ghost"
              disabled={busy}
              aria-label={tr('新对话')}
              title={tr('新对话')}
              onClick={() => {
                setId('');
                setTurns([]);
                setProfileContext(undefined);
                setReplyAction(null);
                setReport(null);
                setTab('chat');
              }}
            >
              <Plus size={19} />
            </Button>
            {id && !report && (
              <>
                <Button
                  variant="ghost"
                  disabled={busy}
                  title={tr('重命名对话')}
                  onClick={() => setRename(true)}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  title={tr('删除对话')}
                  onClick={() =>
                    setDeleteTarget({ kind: 'chat', id, title: list.find(c => c.id === id)?.title || '' })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              </>
            )}
            {report && (
              <>
                <Button variant="ghost" onClick={() => setEdit(true)}>
                  {tr('编辑')}
                </Button>
                <Button variant="ghost" onClick={() => download('html')}>
                  <Download size={15} />
                  {tr('图文HTML')}
                </Button>
                <Button variant="ghost" onClick={() => download('md')}>
                  Markdown
                </Button>
                <Button
                  variant="ghost"
                  title={tr('删除报告')}
                  onClick={() =>
                    setDeleteTarget({
                      kind: 'report',
                      id: report.id,
                      title: report.title,
                      version: report.version,
                    })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              </>
            )}
          </div>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {tr(error)}
          </p>
        )}
        {notice && <p className={styles.notice}>{tr(notice)}</p>}
        <div className={styles.financeMessages} role="region" aria-label={tr('财务对话')} ref={bodyRef}>
          <div ref={messageContent}>
            {report ? (
              <>
                <h1>{report.title}</h1>
                <details className={styles.contextDetails}>
                  <summary>{tr('报告信息')}</summary>
                  <p className={styles.muted}>
                    {tr('保存于')}
                    {new Date(report.created_at).toLocaleString(getLocale())} {tr('· 参考月份')}
                    {report.artifacts.month || tr('见正文')} {tr('· 模型')}
                    {report.model} {tr('· 数据为当时快照')}
                  </p>
                </details>
                <div data-report-body className={styles.reportBody}>
                  <FinanceNarrative book={book} text={report.content} artifacts={report.artifacts} />
                </div>
              </>
            ) : tab === 'reports' ? (
              <div className={styles.financeEmpty}>
                <FileText size={36} />
                <h2>{tr('把有用的分析，留成报告')}</h2>
                <p>{tr('选择一份报告，或将对话回答保存为报告。')}</p>
              </div>
            ) : (
              <>
                {!turns.length && (
                  <div className={styles.financeEmpty}>
                    <img src={themes[theme].icon} width={58} height={58} alt="" />
                    <h2>{tr('想记什么，聊聊就好')}</h2>
                    <p className={styles.financeWelcomeCaption}>{tr('记账、整理订阅，或看看最近的开销。')}</p>
                    <div className={styles.financeSuggestions}>
                      {[
                        '帮我记一笔，缺少的信息请问我',
                        '帮我设置一个周期订阅',
                        '把通勤消费保存为常用一笔',
                        '分析这个月的财务状况，生成图文报告',
                      ].map(q => (
                        <Button
                          key={q}
                          disabled={busy}
                          onClick={() => {
                            setText(tr(q));
                            bodyRef.current?.parentElement?.querySelector('textarea')?.focus();
                          }}
                        >
                          {tr(q)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {turns.map((t, index) => (
                  <article className={styles.financeTurn} key={t.id}>
                    <div className={styles.financeQuestion}>
                      <QueryScope books={t.artifacts.analysisBooks} />
                      <span>{t.question}</span>
                      {!!t.artifacts.images?.length && (
                        <small className={styles.financeQuestionAttachments}>
                          <Images size={15} />
                          {tr('已附 {0} 张图片').replace('{0}', String(t.artifacts.images.length))}
                        </small>
                      )}
                    </div>
                    <div className={styles.financeAnswer}>
                      {index === 0 && <img src={themes[theme].icon} width={32} height={32} alt="" />}
                      {t.artifacts.tools?.length > 0 && (
                        <details className={styles.toolTraces}>
                          <summary>
                            {tr('已执行')}
                            {t.artifacts.tools.length} {tr('次工具查询')}
                          </summary>
                          {t.artifacts.tools.map((tool, i) => (
                            <div key={i}>
                              <strong>{tool.label}</strong>
                              <small>{toolScope(tool.args)}</small>
                              {(tool.result as any)?.error && (
                                <p className={styles.error}>{(tool.result as any).error}</p>
                              )}
                            </div>
                          ))}
                        </details>
                      )}
                      <FinanceNarrative book={book} text={t.answer} artifacts={t.artifacts} />
                      {t.error && <p className={styles.error}>{t.error}</p>}
                      {!t.artifacts.actions?.length && t.artifacts.drafts?.length > 0 && (
                        <div className={styles.draftChatCard}>
                          <strong>
                            {tr('整理出')}
                            {t.artifacts.drafts.length} {tr('笔待确认草稿')}
                          </strong>
                          <></>
                          <Button
                            variant="primary"
                            disabled={busy || !canWrite}
                            onClick={() => onDrafts(t.artifacts.drafts)}
                          >
                            {tr('送到记账草稿核对')}
                          </Button>
                        </div>
                      )}
                      {!!t.artifacts.links?.length && (
                        <div className={styles.assistantLinks}>
                          {t.artifacts.links.map((link, i) =>
                            link.page ? (
                              <Button
                                key={i}
                                onClick={() => {
                                  if (link.helpId) sessionStorage.setItem('help-article', link.helpId);
                                  onNavigate?.(link.page!);
                                }}
                              >
                                {tr('打开')} · {tr(link.title)}
                              </Button>
                            ) : link.downloadUrl?.startsWith('/api/books/') ? (
                              <a className={styles.button} key={i} href={link.downloadUrl} download>
                                {tr(link.title)}
                              </a>
                            ) : null,
                          )}
                        </div>
                      )}
                      {!!cardsByTurn.get(t.id)?.length && (
                        <ChatActionCards
                          onUndo={setUndoId}
                          undone={undone}
                          onEdit={async (actionId, data) => {
                            await api(book, {
                              operation: 'edit_action',
                              id,
                              turnId: latestTurn!.id,
                              actionId,
                              data,
                            });
                            await load(id);
                          }}
                          actions={cardsByTurn.get(t.id)!}
                          confirmable={latestTurn?.status === 'complete'}
                          disabled={busy || latestTurn?.status === 'running'}
                          onConfirm={async (actionId, acknowledgeWarnings) => {
                            await api(book, {
                              operation: 'confirm_action',
                              id,
                              turnId: latestTurn!.id,
                              actionId,
                              acknowledgeWarnings,
                            });
                            await load(id);
                            setRevision(n => n + 1);
                            await onChanged?.();
                            setNotice('已保存，可继续描述下一项操作。');
                          }}
                          onCancel={async actionId => {
                            await api(book, {
                              operation: 'cancel_action',
                              id,
                              turnId: latestTurn!.id,
                              actionId,
                            });
                            await load(id);
                          }}
                          onRevise={a => {
                            setReplyAction(a);
                            setText('');
                            bodyRef.current?.parentElement?.querySelector('textarea')?.focus();
                          }}
                        />
                      )}
                      {t.status === 'complete' && (
                        <div className={styles.answerActions}>
                          <small>{t.model}</small>
                          <Button variant="ghost" onClick={() => saveReport(t)}>
                            <FileText size={15} />
                            {tr('保存为报告')}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setText('请基于最新账目重新生成：' + t.question);
                            }}
                          >
                            {tr('重新分析')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                {!busy && turns.some(t => t.status === 'running') && (
                  <p role="status">{tr('这段对话正在后台处理，完成后自动显示。')}</p>
                )}
                {busy && (
                  <p className={styles.financeProgress} role="status">
                    {status || tr('正在连接助手…')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {showLatest && (
          <Button
            className={styles.financeJump}
            onClick={() => {
              bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
              nearBottom.current = true;
              setShowLatest(false);
            }}
          >
            {tr('回到最新消息')} ↓
          </Button>
        )}
        {tab === 'chat' && !report && (
          <FinanceComposer
            locationControl={
              useHistory ? (
                <ProfileLocation value={profileContext} onChange={setProfileContext} disabled={busy} />
              ) : undefined
            }
            book={book}
            text={text}
            onText={setText}
            images={images}
            onImages={setImages}
            busy={busy}
            uploading={uploading}
            onUploading={setUploading}
            useHistory={useHistory}
            onHistory={setUseHistory}
            onSend={() => send()}
            onBackground={() => abort.current?.abort()}
            onError={setError}
            reply={
              replyAction
                ? replyAction.data.title || replyAction.data.name || tr(replyAction.title)
                : undefined
            }
            onCancelReply={() => setReplyAction(null)}
          />
        )}
      </div>
      {(edit || rename) && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          wide={edit}
          title={edit ? tr('编辑报告') : tr('重命名对话')}
          onClose={() => {
            setEdit(false);
            setRename(false);
          }}
        >
          <form
            className={styles.sheetForm}
            onSubmit={async e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                if (edit && report) {
                  await api(book, {
                    operation: 'edit_report',
                    id: report.id,
                    version: report.version,
                    title: f.get('title'),
                    content: f.get('content'),
                  });
                  setReport({
                    ...report,
                    title: String(f.get('title')),
                    content: String(f.get('content')),
                    version: report.version + 1,
                  });
                } else await api(book, { operation: 'rename', id, title: f.get('title') });
                await refresh();
                setEdit(false);
                setRename(false);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              {tr('标题')}
              <Input
                name="title"
                defaultValue={edit ? report?.title : list.find(c => c.id === id)?.title}
                required
                maxLength={100}
              />
            </label>
            {edit && (
              <label>
                {tr('正文（保留图表标记即可继续显示图表）')}
                <TextArea name="content" rows={16} defaultValue={report?.content} />
              </label>
            )}
            <Button type="submit" variant="primary">
              {tr('保存')}
            </Button>
          </form>
        </Sheet>
      )}
      {deleteTarget && (
        <ConfirmDialog
          open
          title={tr('确认删除')}
          confirmLabel={tr('确认删除')}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await api(
                book,
                deleteTarget.kind === 'report'
                  ? { operation: 'delete_report', id: deleteTarget.id, version: deleteTarget.version }
                  : { operation: 'delete', id: deleteTarget.id },
              );
              if (deleteTarget.kind === 'report') {
                if (report?.id === deleteTarget.id) setReport(null);
              } else if (id === deleteTarget.id) {
                setId('');
                setTurns([]);
                setReplyAction(null);
              }
              setDeleteTarget(null);
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <p>
            {tr('删除')}
            {deleteTarget.kind === 'report' ? tr('这份报告') : tr('这段对话')}：{deleteTarget.title}
            {tr('？不会删除账本交易或其他已保存报告。')}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
