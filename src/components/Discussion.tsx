'use client';
import { Avatar } from './ManagementPages';
import { Button, TextArea } from '@/ui';
import s from './Discussion.module.css';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MessageCircle, Reply, X } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import type { DiscussionMessage, DiscussionTarget } from '@/lib/discussions';

export async function discussionRequest(path: string, body?: unknown, signal?: AbortSignal) {
  const r = await fetch('/api/discussions' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const d = await r.json();
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { status: r.status });
  return d;
}
function participantAvatar(value?: string) {
  return value && value !== '🧸' ? value : '👤';
}
export function Discussion({
  target,
  hideUnavailable = false,
  revision,
}: {
  target: DiscussionTarget;
  hideUnavailable?: boolean;
  revision?: string;
}) {
  const { locale, t: tr } = useI18n();
  const inputId = useId(),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [unavailable, setUnavailable] = useState(false),
    [text, setText] = useState(''),
    [reply, setReply] = useState<DiscussionMessage | null>(null),
    [busy, setBusy] = useState(false),
    [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(true);
  const requestId = useRef(''),
    section = useRef<HTMLElement>(null),
    lastMarked = useRef('');
  const { kind, id, scope = '' } = target;
  const markRead = useCallback(
    async (d: any, signal?: AbortSignal) => {
      const rect = section.current?.getBoundingClientRect(),
        seq = d.rows.at(-1)?.seq;
      if (
        offset ||
        !seq ||
        seq === lastMarked.current ||
        document.visibilityState !== 'visible' ||
        !rect ||
        rect.bottom <= 0 ||
        rect.top >= innerHeight
      )
        return;
      await discussionRequest('/read', { target: { kind, id, scope }, upTo: seq }, signal);
      lastMarked.current = seq;
      window.dispatchEvent(new Event('discussions-changed'));
    },
    [kind, id, scope, offset],
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const d = await discussionRequest(
        '?' + new URLSearchParams({ kind, id, scope, offset: String(offset) }),
        undefined,
        signal,
      );
      setData(d);
      setError('');
      setUnavailable(false);
      await markRead(d, signal);
    },
    [kind, id, scope, offset, markRead, revision],
  );
  useEffect(() => {
    if (!data || !section.current) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting))
        void markRead(data, controller.signal).catch(e => {
          if (!controller.signal.aborted) setError(e.message);
        });
    });
    observer.observe(section.current);
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [data, markRead]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError('');
    setUnavailable(false);
    load(controller.signal)
      .catch(e => {
        if (!controller.signal.aborted) {
          if (e.status === 404 && hideUnavailable) setUnavailable(true);
          else setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [load, hideUnavailable]);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === 'visible')
        void load(controller.signal).catch(e => {
          if (!controller.signal.aborted) {
            setData(null);
            setError(e.message);
          }
        });
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);
  async function send() {
    setBusy(true);
    setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      await discussionRequest('/messages', {
        target: { kind, id, scope },
        id: requestId.current,
        body: text,
        replyTo: reply?.id || null,
      });
      setText('');
      setReply(null);
      requestId.current = '';
      if (offset) setOffset(0);
      else await load();
      window.dispatchEvent(new Event('discussions-changed'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (unavailable) return null;
  return (
    <section
      ref={section}
      className={s.thread}
      aria-label={locale === 'en' ? tr('账目讨论分区') : tr('账目讨论')}
    >
      <div className={s.heading}>
        <h3>
          <MessageCircle size={19} />
          {scope ? tr('本期讨论') : tr('账目讨论')}
        </h3>
        <Button
          type="button"
          variant="ghost"
          disabled={loading || busy}
          onClick={() => {
            setLoading(true);
            void load()
              .catch(e => setError(e.message))
              .finally(() => setLoading(false));
          }}
        >
          {tr('刷新')}
        </Button>
      </div>
      {data && (
        <p className={s.muted}>
          {kind === 'claim'
            ? tr('仅付款人和认领人可见')
            : kind === 'movement'
              ? tr('仅转账双方可见')
              : kind === 'transaction'
                ? tr('本共享账本有权查看的成员可见')
                : tr('本项目参与成员可见')}{' '}
          · {data.people.map((p: any) => p.name).join('、')}
          {scope && <> · {scope}</>}
        </p>
      )}
      {data?.context.note && (
        <div className={s.quote}>
          <strong>{tr('转账留言')}</strong>
          <p>{data.context.note}</p>
        </div>
      )}
      {loading && <p role="status">{tr('正在读取讨论…')}</p>}
      {!loading && data && !data.rows.length && (
        <p className={s.muted}>{tr('还没有留言，可以在这里核对用途、金额或分担。')}</p>
      )}
      {data?.rows.map((m: DiscussionMessage) => (
        <article className={s.message} key={m.id}>
          <div className={s.meta}>
            <span className={s.person}>
              <Avatar value={participantAvatar(m.avatar)} size={34} />
              <strong>
                {m.name}
                {m.user_id === data.userId ? tr('（我）') : ''}
              </strong>
            </span>
            <time dateTime={m.created_at}>
              {new Date(m.created_at).toLocaleString(locale, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
          {m.reply_to && (
            <blockquote>
              <span className={s.person}>
                <Avatar value={participantAvatar(m.reply_avatar || undefined)} size={24} />
                <strong>{m.reply_name}</strong>
              </span>
              <p>{m.reply_body}</p>
            </blockquote>
          )}
          <p className={s.body}>{m.body}</p>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            aria-label={tr('回复 {0}', [m.name])}
            onClick={() => {
              setReply(m);
              requestId.current = '';
              document.getElementById(inputId)?.focus();
            }}
          >
            <Reply size={15} />
            {tr('回复')}
          </Button>
        </article>
      ))}
      {data?.total > 20 && (
        <nav className={s.actions} aria-label={tr('讨论分页')}>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || busy || offset + 20 >= data.total}
            onClick={() => setOffset(v => v + 20)}
          >
            {tr('更早留言')}
          </Button>
          <span>
            {Math.max(1, data.total - offset - 19)}–{data.total - offset} / {data.total}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || busy || !offset}
            onClick={() => setOffset(v => Math.max(0, v - 20))}
          >
            {tr('更新留言')}
          </Button>
        </nav>
      )}
      {error && (
        <p className={s.error} role="alert">
          {tr(error)}
        </p>
      )}
      {data && (
        <form
          className={s.composer}
          onSubmit={e => {
            e.preventDefault();
            void send();
          }}
        >
          {reply && (
            <div className={s.quote}>
              <span>
                <Avatar value={participantAvatar(reply.avatar)} size={24} /> {tr('回复 {0}', [reply.name])}：
                {reply.body}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label={tr('取消回复')}
                onClick={() => {
                  setReply(null);
                  requestId.current = '';
                }}
              >
                <X size={17} />
              </Button>
            </div>
          )}
          <label className={s.person} htmlFor={inputId}>
            <Avatar
              value={participantAvatar(data.people.find((p: any) => p.id === data.userId)?.avatar)}
              size={30}
            />
            {tr('留言给参与成员')}
          </label>
          <TextArea
            id={inputId}
            rows={3}
            maxLength={2000}
            value={text}
            disabled={busy}
            onChange={e => {
              setText(e.target.value);
              requestId.current = '';
            }}
          />
          <div className={s.actions}>
            <small className={s.muted}>{tr('留言不会确认收款或修改分摊。')}</small>
            <Button type="submit" disabled={busy || !text.trim()}>
              {busy ? tr('发送中…') : tr('发送留言')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
