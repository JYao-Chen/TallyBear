'use client';
import { Button, ChipButton, Input } from '@/ui';
import styles from './HelpPage.module.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  ExternalLink,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { helpArticles, helpKeywordScore, helpTerms, type HelpArticle } from '@/lib/help-manual';
import { type HelpTarget } from '@/lib/help-guide';
import { useI18n } from './LanguageProvider';

export function HelpHighlight({ text, query }: { text: string; query: string }) {
  const words = helpTerms(query).sort((a, b) => b.length - a.length);
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(
    '(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
    'gi',
  );
  return <>{text.split(pattern).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>;
}
type Result = HelpArticle & { snippet: string; match: string };
function HelpFigure({ image, caption, en }: { image: string; caption: string; en: boolean }) {
  const { t: tr } = useI18n();
  const [device, setDevice] = useState<'desktop' | 'mobile' | null>(null);
  useEffect(() => {
    setDevice(window.matchMedia('(max-width:600px)').matches ? 'mobile' : 'desktop');
  }, []);
  const selected = device || 'desktop',
    src = `/help/v2/${en ? 'en' : 'zh'}-${selected}-${image}.webp`;
  return (
    <figure className={styles.helpFigure} data-device={selected}>
      <div className={styles.helpFigureToolbar}>
        <div role="group" aria-label={tr('截图视图')}>
          {(['desktop', 'mobile'] as const).map(d => (
            <Button
              variant="primary"
              key={d}
              type="button"
              aria-pressed={selected === d}
              onClick={() => setDevice(d)}
            >
              {d === 'desktop' ? <Monitor size={14} /> : <Smartphone size={14} />}
              <span>{d === 'desktop' ? tr('电脑') : tr('手机')}</span>
            </Button>
          ))}
        </div>
        <a href={src} target="_blank" rel="noreferrer">
          {tr('完整截图')}
          <ExternalLink size={14} />
        </a>
      </div>
      <a
        className={styles.helpImageLink}
        href={src}
        target="_blank"
        rel="noreferrer"
        aria-label={tr('查看完整截图')}
      >
        <img loading="lazy" src={src} alt={caption} />
      </a>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
export function HelpPage({
  onNavigate,
  onAsk,
  canAsk = true,
}: {
  onNavigate?: (target: HelpTarget) => void;
  onAsk?: (question: string) => void;
  canAsk?: boolean;
}) {
  const { locale, t: tr } = useI18n();
  const en = locale === 'en';
  const articles = useMemo(() => helpArticles(locale), [locale]);
  const [query, setQuery] = useState(''),
    [section, setSection] = useState('intro'),
    [reading, setReading] = useState(true),
    [results, setResults] = useState<Result[]>([]),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState('keyword'),
    [error, setError] = useState(false),
    [page, setPage] = useState(1);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = sessionStorage.getItem('help-article');
    if (id && articles.some(a => a.id === id)) setSection(id);
    fetch('/api/help').catch(() => {});
  }, [articles]);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setError(false);
    setPage(1);
    const local = articles
      .filter(a => helpKeywordScore(a, query) > 0)
      .sort((a, b) => helpKeywordScore(b, query) - helpKeywordScore(a, query))
      .map(a => ({
        ...a,
        snippet:
          [a.intro, ...a.steps, ...a.notes].find(p =>
            helpTerms(query).some(w => p.toLowerCase().includes(w)),
          ) || a.intro,
        match: 'keyword',
      }));
    setResults(local);
    setMode('keyword');
    const timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/help?q=' + encodeURIComponent(query), { signal: controller.signal });
        if (!r.ok) throw new Error();
        const data = await r.json();
        setResults(data.items);
        setMode(data.mode);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, articles]);
  useEffect(() => {
    if (reading && query) content.current?.querySelector('mark')?.scrollIntoView({ block: 'center' });
  }, [reading, section, query]);
  const article = articles.find(a => a.id === section) || articles[0];
  const index = articles.indexOf(article);
  const groups = [...new Set(articles.map(a => a.group))];
  const open = (id: string) => {
    setSection(id);
    setReading(true);
    sessionStorage.setItem('help-article', id);
  };
  const highlight = (text: string) => <HelpHighlight text={text} query={query} />;
  const feature = (action: { target: HelpTarget; label: string } | undefined) =>
    action && onNavigate ? (
      <Button type="button" className={styles.helpFeatureLink} onClick={() => onNavigate(action.target)}>
        {action.label}
        <ArrowRight size={15} />
      </Button>
    ) : null;
  const ask = () =>
    onAsk?.(tr('请查阅使用说明中“{0}”这一章，帮我解答操作问题。我的问题是：', [article.title]));
  return (
    <div className={styles.helpPage}>
      <div className={styles.pageHeading}>
        <div>
          <h1>{tr('使用说明')}</h1>
          <p>{tr('从第一笔记录开始，了解 TallyBear 的日常记账与家庭协作。')}</p>
        </div>
      </div>
      <label className={styles.helpSearch}>
        <Search size={18} />
        <Input
          type="search"
          maxLength={300}
          aria-label={en ? 'Search the manual' : tr('搜索使用说明')}
          placeholder={tr('输入关键词或问题：退款怎么记？')}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setReading(!e.target.value.trim());
          }}
        />
      </label>
      <nav className={styles.helpMobileChapters} aria-label={tr('说明章节')}>
        {articles.map(a => (
          <ChipButton
            key={a.id}
            selected={reading && section === a.id}
            onClick={() => {
              setQuery('');
              open(a.id);
            }}
          >
            {a.title}
          </ChipButton>
        ))}
      </nav>
      <div className={styles.helpLayout}>
        <nav className={styles.helpTopics} aria-label={tr('说明章节')}>
          {groups.map(g => (
            <div className={styles.helpTopicGroup} key={g}>
              <p>{g}</p>
              {articles
                .filter(a => a.group === g)
                .map(a => (
                  <Button
                    variant="primary"
                    type="button"
                    key={a.id}
                    aria-current={reading && section === a.id ? 'page' : undefined}
                    onClick={() => {
                      setQuery('');
                      open(a.id);
                      content.current?.scrollIntoView({ block: 'start' });
                    }}
                  >
                    <span>{String(articles.indexOf(a) + 1).padStart(2, '0')}</span>
                    {a.title}
                  </Button>
                ))}
            </div>
          ))}
        </nav>
        <div className={styles.helpContent} ref={content} role="region" aria-label={tr('使用说明')}>
          {!reading && query.trim() ? (
            <>
              <div className={styles.helpResultStatus} role="status">
                {busy
                  ? tr('正在搜索…')
                  : tr('{0} 个章节 · {1}', [
                      results.length,
                      mode === 'hybrid' ? tr('关键词 + 语义检索') : tr('关键词检索'),
                    ])}
                {error && <p>{tr('检索服务暂不可用，已展示本地关键词结果。')}</p>}
              </div>
              {results.slice((page - 1) * 6, page * 6).map(a => (
                <Button type="button" className={styles.helpResult} key={a.id} onClick={() => open(a.id)}>
                  <strong>{highlight(a.title)}</strong>
                  <span>{highlight(a.snippet)}</span>
                  <small>
                    {a.match === 'semantic' ? tr('语义相关') : tr('文字匹配')} · {tr('阅读本章')}{' '}
                    <ArrowRight size={14} />
                  </small>
                </Button>
              ))}
              {!busy && !results.length && <p>{tr('未找到相关章节，请缩短问题或从目录浏览。')}</p>}
              {results.length > 6 && (
                <div className={styles.helpPagination}>
                  <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    {tr('上一页')}
                  </Button>
                  <span>
                    {page} / {Math.ceil(results.length / 6)}
                  </span>
                  <Button disabled={page * 6 >= results.length} onClick={() => setPage(p => p + 1)}>
                    {tr('下一页')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <article key={article.id} aria-label={article.title}>
              {query && (
                <Button variant="ghost" onClick={() => setReading(false)}>
                  <ArrowLeft size={16} />
                  {tr('返回搜索结果')}
                </Button>
              )}
              <header className={styles.helpChapterHeader}>
                <h2>{highlight(article.title)}</h2>
                <p className={styles.helpChapterPosition}>
                  {article.group} · {index + 1} / {articles.length}
                </p>
                <p className={styles.helpLead}>{highlight(article.intro)}</p>
                {onAsk && (
                  <>
                    <Button type="button" className={styles.helpAsk} disabled={!canAsk} onClick={ask}>
                      <MessageCircle size={17} />
                      {tr('询问助手')}
                    </Button>
                    {!canAsk && <small>{tr('创建或选择账本后即可向助手提问。')}</small>}
                  </>
                )}
              </header>
              <nav className={styles.helpSectionToc} aria-label={tr('本章内容')}>
                <strong>{tr('本章内容')}</strong>
                {article.sections.map(s => (
                  <a href={`#guide-${article.id}-${s.id}`} key={s.id}>
                    {s.title}
                  </a>
                ))}
              </nav>
              {article.sections.map(s => (
                <section className={styles.helpSection} id={`guide-${article.id}-${s.id}`} key={s.id}>
                  <h3>{highlight(s.title)}</h3>
                  {s.paragraphs.map((p, i) => (
                    <p key={i}>{highlight(p)}</p>
                  ))}
                  {!!s.steps.length && (
                    <ol className={styles.helpSteps}>
                      {s.steps.map((step, i) => (
                        <li key={i}>
                          <div>
                            <h4>{highlight(step.title)}</h4>
                            <p>{highlight(step.text)}</p>
                            {feature(step.action)}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {s.example && (
                    <aside aria-label={tr('示例')} className={styles.helpCallout}>
                      <strong>{tr('示例')}</strong>
                      <p>{highlight(s.example)}</p>
                    </aside>
                  )}
                  {s.note && (
                    <aside className={`${styles.helpCallout} ${styles.helpNote}`}>
                      <strong>{tr('注意事项')}</strong>
                      <p>{highlight(s.note)}</p>
                    </aside>
                  )}
                  {!!s.questions.length && (
                    <dl className={styles.helpFaq}>
                      {s.questions.map((q, i) => (
                        <div key={i}>
                          <dt>{highlight(q.q)}</dt>
                          <dd>{highlight(q.a)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {feature(s.action)}
                  {s.figures.map(f => (
                    <HelpFigure key={f.key} image={f.key} caption={f.caption} en={en} />
                  ))}
                </section>
              ))}
              {onAsk && (
                <div className={styles.helpSupport}>
                  <div>
                    <strong>{tr('这一步还有疑问？')}</strong>
                    <p>{tr('把本章主题带给助手，再描述你遇到的问题。')}</p>
                  </div>
                  <Button type="button" disabled={!canAsk} onClick={ask}>
                    <MessageCircle size={17} />
                    {tr('询问助手')}
                  </Button>
                </div>
              )}
              <div className={styles.helpPagination}>
                <Button
                  disabled={!index}
                  onClick={() => {
                    setQuery('');
                    open(articles[index - 1].id);
                    content.current?.scrollIntoView({ block: 'start' });
                  }}
                >
                  {tr('上一章')}
                </Button>
                <span>
                  {index + 1} / {articles.length}
                </span>
                <Button
                  disabled={index === articles.length - 1}
                  onClick={() => {
                    setQuery('');
                    open(articles[index + 1].id);
                    content.current?.scrollIntoView({ block: 'start' });
                  }}
                >
                  {tr('下一章')}
                </Button>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
