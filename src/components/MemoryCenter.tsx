'use client';
import { Button, Input, ListRow, Sheet, TextArea } from '@/ui';
import styles from './MemoryCenter.module.css';
import { useConfirmation } from '@/ui/useConfirmation';
import { useI18n } from './LanguageProvider';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/deployment';
import { ChevronDown, Brain, BookOpen, Clock3, History, Settings2, LockKeyhole } from 'lucide-react';
import { MemoryHistory } from './MemoryHistory';

import type { Memory } from '@/lib/memory';
async function api(query = '', body?: unknown) {
  const r = await fetch('/api/memories' + query, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || '请求失败');
  return value;
}
const kinds: Record<string, string> = {
  product: '商品与服务',
  preference: '记账偏好',
  subscription: '订阅',
  activity: '活动',
  conversation: '对话记忆',
  todo: '待办',
  negative: '排除的关联',
};
export function MemoryCenter({
  admin = false,
  initialId,
  embedded = false,
  onOpen,
}: {
  admin?: boolean;
  initialId?: string;
  embedded?: boolean;
  onOpen?: () => void;
}) {
  const { t: tr, locale } = useI18n();
  if (embedded) return <MemoryWorkspace admin={admin} initialId={initialId} />;
  return (
    <Button
      type="button"
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new CustomEvent('tallybear:memory', { detail: initialId || '' }));
      }}
    >
      <Brain size={18} />
      {tr('个人画像')}
    </Button>
  );
}
export function MemoryWorkspace({
  admin,
  initialId,
  view,
  initialKind,
}: {
  admin: boolean;
  initialId?: string;
  view?: string;
  initialKind?: string;
}) {
  const { confirmation, requestConfirmation } = useConfirmation();
  const { t: tr, locale } = useI18n();
  const [section, setSection] = useState('collection'),
    [loading, setLoading] = useState(true),
    [items, setItems] = useState<Memory[]>([]),
    [q, setQ] = useState(''),
    [kind, setKind] = useState(''),
    [status, setStatus] = useState('active'),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<Memory | null>(null),
    [enabled, setEnabled] = useState(true),
    [detail, setDetail] = useState<any>(null),
    [families, setFamilies] = useState<any[]>([]);
  useEffect(() => {
    if (view) {
      setSection(view);
      setStatus(view === 'pending' ? 'pending' : 'active');
      setKind(initialKind || '');
      setPage(1);
      setSelected(null);
    }
  }, [view, initialKind]);
  const selectionRequest = useRef(0);
  const [replaceConflicts, setReplaceConflicts] = useState(false);
  const [ruleMatch, setRuleMatch] = useState(''),
    [ruleScope, setRuleScope] = useState('product'),
    [referenceType, setReferenceType] = useState('activity'),
    [referenceId, setReferenceId] = useState(''),
    [references, setReferences] = useState<any[]>([]),
    [referenceQuery, setReferenceQuery] = useState(''),
    [referencePage, setReferencePage] = useState(1),
    [brand, setBrand] = useState(''),
    [specification, setSpecification] = useState(''),
    [editTitle, setEditTitle] = useState(''),
    [editContent, setEditContent] = useState(''),
    [aliases, setAliases] = useState(''),
    [category, setCategory] = useState(''),
    [target, setTarget] = useState(''),
    [targets, setTargets] = useState<Memory[]>([]),
    [targetQuery, setTargetQuery] = useState(''),
    [sourcePage, setSourcePage] = useState(1);
  useEffect(() => {
    if (!selected?.id) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        api('?kind=product&q=' + encodeURIComponent(targetQuery))
          .then(r => {
            if (alive) setTargets(r.items.filter((m: Memory) => m.id !== selected.id && !m.family_id));
          })
          .catch(e => {
            if (alive) setError(e.message);
          }),
      250,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [selected?.id, targetQuery]);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    const timer = setTimeout(
      () =>
        api(
          '?' +
            new URLSearchParams({ targets: referenceType, q: referenceQuery, page: String(referencePage) }),
        )
          .then(r => {
            if (alive) setReferences(r.items);
          })
          .catch(e => {
            if (alive) setError(e.message);
          }),
      250,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [selected?.id, referenceType, referenceQuery, referencePage]);
  async function load() {
    const r = await api('?' + new URLSearchParams({ q, kind, status, page: String(page) }));
    setItems(r.items);
    setTotal(r.total);
  }
  useEffect(() => {
    setLoading(true);
    let active = true;
    const timer = setTimeout(() => {
      api('?' + new URLSearchParams({ q, kind, status, page: String(page) }))
        .then(r => {
          if (active) {
            setItems(r.items);
            setTotal(r.total);
            setLoading(false);
          }
        })
        .catch(e => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, kind, status, page]);
  async function run(body: any) {
    setBusy(true);
    setError('');
    try {
      const result = await api('', body);
      setMessage(
        result.jobId
          ? tr('后台任务已创建，可在任务列表查看进度。')
          : result.pending
            ? tr('规则与已有偏好冲突，已存入待确认；旧规则未改变。')
            : tr('已保存'),
      );
      await load();
      setSelected(null);
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function select(m: Memory) {
    const request = ++selectionRequest.current;
    setReplaceConflicts(false);
    setSelected(m);
    setEditTitle(m.title);
    setEditContent(m.content);
    setAliases(m.aliases.join('\n'));
    setReferenceType(m.attributes.targetType || 'activity');
    setReferenceId(m.attributes.targetId || '');
    setReferencePage(1);
    setCategory(m.attributes.category || '');
    setRuleMatch(m.attributes.match || '');
    setRuleScope(m.attributes.scope || 'product');
    setBrand(m.attributes.brand || '');
    setSpecification(m.attributes.specification || '');
    setTarget('');
    setDetail(null);
    setSourcePage(1);
    try {
      const result = await api('?id=' + m.id);
      if (selectionRequest.current === request) setDetail(result);
    } catch (e) {
      if (selectionRequest.current === request) setError((e as Error).message);
    }
  }
  useEffect(() => {
    api('?settings')
      .then(r => setEnabled(r.enabled))
      .catch(e => setError(e.message));
    if (initialId)
      api('?id=' + initialId)
        .then(r => select(r.memory))
        .catch(e => setError(e.message));
  }, [initialId]);
  return (
    <div role="region" aria-label={tr('记忆中心')} className={styles.memoryWorkspace}>
      {confirmation}
      {!view && (
        <div className={styles.memoryHeading}>
          <div>
            <h2>{tr('记忆中心')}</h2>
            <p className={styles.muted}>
              {tr('整理你的商品、习惯与财务记忆。记忆只辅助填充，不会自行改动账单。')}
            </p>
          </div>
          <span className={styles.memoryPrivacy}>
            <LockKeyhole size={14} aria-hidden="true" />
            {tr('个人私有 · 分享需确认')}
          </span>
        </div>
      )}
      {!view && (
        <nav className={styles.memorySections} aria-label={tr('记忆中心栏目')}>
          {[
            { key: 'collection', label: tr('我的记忆'), icon: BookOpen },
            { key: 'pending', label: tr('待确认'), icon: Clock3 },
            { key: 'events', label: tr('变更记录'), icon: History },
            { key: 'settings', label: tr('学习与设置'), icon: Settings2 },
          ].map(({ key, label, icon: Icon }) => (
            <Button
              type="button"
              aria-pressed={section === key}
              key={key}
              onClick={() => {
                setSection(key);
                setSelected(null);
                setPage(1);
                setError('');
                setMessage('');
                if (key === 'collection') setStatus('active');
                if (key === 'pending') setStatus('pending');
              }}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>
      )}
      {error && !selected && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {section === 'settings' && (
        <section className={styles.memorySettings}>
          <h3>{tr('学习与数据管理')}</h3>
          <p className={styles.muted}>{tr('保存账目不等待记忆整理。遗忘记忆不会删除原账单。')}</p>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={busy}
              onChange={e => {
                const value = e.target.checked;
                run({ operation: 'settings', enabled: value }).then(r => {
                  if (r) setEnabled(value);
                });
              }}
            />
            {tr('启用个人记忆学习')}
          </label>
          <div className={styles.memoryActions}>
            <Button
              variant="primary"
              type="button"
              disabled={busy}
              onClick={() => {
                requestConfirmation(
                  tr('将整理全部可访问的个人账单与财务对话，并向已配置的记忆模型发送必要内容。继续？'),
                  () => run({ operation: 'history' }),
                );
              }}
            >
              {tr('整理历史记忆')}
            </Button>
            <Button type="button" disabled={busy} onClick={() => run({ operation: 'rebuild' })}>
              {tr('重建向量')}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                try {
                  const r = await api('', { operation: 'export' });
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }),
                  );
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'tallybear-memory.json';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {tr('导出我的记忆')}
            </Button>
          </div>
          <details>
            <summary>{tr('遗忘后的重新学习')}</summary>
            <p>{tr('重新允许全部已排除来源参与历史整理。')}</p>
            <Button
              variant="primary"
              type="button"
              disabled={busy}
              onClick={() => {
                requestConfirmation(tr('清除来源排除标记并重新学习？'), () => run({ operation: 'learn' }));
              }}
            >
              {tr('允许重新学习')}
            </Button>
          </details>
          {admin && <MemoryModels />}
        </section>
      )}
      {section === 'events' && <MemoryHistory />}
      {(section === 'collection' || section === 'pending') && (
        <div className={styles.memoryWorkbench}>
          <section aria-label={tr('我的记忆')} className={styles.memoryCollection}>
            <div className={styles.memoryFilters}>
              <label>
                {tr('搜索记忆')}
                <Input
                  value={q}
                  onChange={e => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label>
                {tr('类型')}
                <select
                  value={kind}
                  onChange={e => {
                    setKind(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{tr('全部类型')}</option>
                  {Object.entries(kinds).map(([k, v]) => (
                    <option key={k} value={k}>
                      {tr(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr('状态')}
                <select
                  disabled={section === 'pending'}
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">{tr('已启用')}</option>
                  <option value="pending">{tr('待确认')}</option>
                  <option value="disabled">{tr('已停用')}</option>
                </select>
              </label>
            </div>
            <Button
              type="button"
              onClick={() => {
                setReplaceConflicts(false);
                setSelected({
                  id: '',
                  kind: 'preference',
                  title: '',
                  content: '',
                  attributes: {},
                  aliases: [],
                  version: 0,
                  status: 'active',
                  owner_id: '',
                  family_id: null,
                  explicit: true,
                });
                setEditTitle('');
                setEditContent('');
                setAliases('');
                setReferenceId('');
                setReferencePage(1);
                setCategory('');
                setRuleMatch('');
                setRuleScope('product');
                setBrand('');
                setSpecification('');
                setDetail(null);
              }}
            >
              {tr('新增明确偏好')}
            </Button>
            {loading && <p role="status">{tr('正在加载记忆…')}</p>}
            {!loading && !items.length && (
              <p className={styles.muted}>{tr('暂无符合条件的记忆。可以先整理历史，或记下一条明确偏好。')}</p>
            )}
            {items.map(m => (
              <article className={styles.memoryRow} key={m.id}>
                <ListRow
                  title={m.title}
                  meta={
                    <>
                      {tr(kinds[m.kind])} · {m.family_id ? tr('家庭共享') : tr('个人')}
                      {m.attributes.category ? ' · ' + m.attributes.category : ''}
                    </>
                  }
                  end={<>{tr('查看与管理')} ›</>}
                  onClick={() => select(m)}
                />
              </article>
            ))}
            <div className={styles.memoryActions}>
              <Button
                variant="primary"
                type="button"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                {tr('上一页')}
              </Button>
              <span>
                {page} / {Math.max(1, Math.ceil(total / 20))} {tr(' · 共 ')}
                {total} {tr(' 条')}
              </span>
              <Button
                variant="primary"
                type="button"
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                {tr('下一页')}
              </Button>
            </div>
          </section>
          {selected && (
            <Sheet
              open
              title={selected.id ? tr('编辑记忆') : tr('新增偏好')}
              onClose={() => setSelected(null)}
            >
              <section className={styles.memoryDetail} key={selected.id}>
                {error && (
                  <p role="alert" className={styles.error}>
                    {error}
                  </p>
                )}

                {selected.kind === 'product' && (
                  <details>
                    <summary className={styles.disclosure}>
                      {tr('自动提炼的商品属性与依据')}
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <p>
                      {tr('规范名称：')}
                      {selected.attributes.canonicalName || tr('未提炼')} {tr(' · 型号：')}
                      {selected.attributes.model || tr('未识别')}
                    </p>
                    {Object.entries(selected.attributes.quotes || {}).map(([key, quote]) => (
                      <p key={key}>
                        {(
                          {
                            name: tr('名称'),
                            brand: tr('品牌'),
                            specification: tr('规格'),
                            model: tr('型号'),
                          } as Record<string, string>
                        )[key] || key}
                        {tr('依据：')}
                        {quote}
                      </p>
                    ))}
                  </details>
                )}
                {selected.kind === 'preference' && (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={replaceConflicts}
                      onChange={e => setReplaceConflicts(e.target.checked)}
                    />
                    {tr('明确以此规则替代同一场景的旧分类规则')}
                  </label>
                )}
                <form
                  className={styles.sheetForm}
                  onSubmit={e => {
                    e.preventDefault();
                    run({
                      operation: 'save',
                      replaceConflicts,
                      ...(selected.id ? { id: selected.id, version: selected.version } : {}),
                      kind: selected.kind,
                      title: editTitle,
                      content: editContent,
                      aliases: aliases
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean),
                      attributes: {
                        ...selected.attributes,
                        targetId: referenceId || undefined,
                        targetType: referenceId ? referenceType : undefined,
                        match: ruleMatch || undefined,
                        scope: ruleScope,
                        category: category || undefined,
                        brand: brand || undefined,
                        specification: specification || undefined,
                      },
                    });
                  }}
                >
                  <h4>{tr('基本信息')}</h4>
                  <label>
                    {tr('名称')}
                    <Input
                      required
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    {tr('描述')}
                    <TextArea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <label>
                    {tr('别名（每行一个）')}
                    <TextArea value={aliases} onChange={e => setAliases(e.target.value)} />
                  </label>
                  {selected.kind === 'preference' && (
                    <>
                      <label>
                        {tr('适用范围')}
                        <select value={ruleScope} onChange={e => setRuleScope(e.target.value)}>
                          <option value="product">{tr('仅此商品')}</option>
                          <option value="merchant">{tr('该商家的消费')}</option>
                        </select>
                      </label>
                      <label>
                        {tr('匹配的商品／商家名称')}
                        <Input value={ruleMatch} onChange={e => setRuleMatch(e.target.value)} />
                      </label>
                    </>
                  )}
                  {selected.kind === 'product' && (
                    <>
                      <h4>{tr('商品属性')}</h4>
                      <label>
                        {tr('品牌')}
                        <Input value={brand} onChange={e => setBrand(e.target.value)} />
                      </label>
                      <label>
                        {tr('规格／套餐')}
                        <Input value={specification} onChange={e => setSpecification(e.target.value)} />
                      </label>
                    </>
                  )}
                  <details>
                    <summary className={styles.disclosure}>
                      {tr('关联已有活动或计划')}
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <label>
                      {tr('对象类型')}
                      <select
                        value={referenceType}
                        onChange={e => {
                          setReferenceType(e.target.value);
                          setReferenceId('');
                          setReferencePage(1);
                        }}
                      >
                        <option value="activity">{tr('活动')}</option>
                        <option value="schedule">{tr('周期计划')}</option>
                        <option value="template">{tr('常用预设')}</option>
                      </select>
                    </label>
                    <label>
                      {tr('搜索对象')}
                      <Input
                        value={referenceQuery}
                        onChange={e => {
                          setReferenceQuery(e.target.value);
                          setReferencePage(1);
                        }}
                      />
                    </label>
                    <label>
                      {tr('选择关联对象')}
                      <select value={referenceId} onChange={e => setReferenceId(e.target.value)}>
                        <option value="">{tr('不关联')}</option>
                        {references.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={styles.memoryActions}>
                      <Button
                        variant="primary"
                        type="button"
                        disabled={referencePage === 1}
                        onClick={() => setReferencePage(p => p - 1)}
                      >
                        {tr('上一页对象')}
                      </Button>
                      <Button
                        variant="primary"
                        type="button"
                        disabled={references.length < 20}
                        onClick={() => setReferencePage(p => p + 1)}
                      >
                        {tr('下一页对象')}
                      </Button>
                    </div>
                  </details>
                  <label>
                    {tr('分类偏好')}
                    <Input value={category} onChange={e => setCategory(e.target.value)} />
                  </label>
                  <div className={styles.memoryActions}>
                    <Button type="submit" variant="primary" disabled={busy}>
                      {tr('保存')}
                    </Button>
                    <Button type="button" onClick={() => setSelected(null)}>
                      {tr('关闭详情')}
                    </Button>
                    {selected.id && (
                      <>
                        <Button
                          variant="primary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run({
                              operation: 'status',
                              id: selected.id,
                              version: selected.version,
                              status: selected.status === 'active' ? 'disabled' : 'active',
                            })
                          }
                        >
                          {selected.status === 'active' ? tr('停用') : tr('确认启用')}
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            requestConfirmation(
                              tr('遗忘此记忆并阻止从这些来源重新学习？原账单不受影响。'),
                              () => run({ operation: 'forget', id: selected.id, version: selected.version }),
                            );
                          }}
                        >
                          {tr('遗忘')}
                        </Button>
                      </>
                    )}
                  </div>
                </form>
                {detail && (
                  <details>
                    <summary className={styles.disclosure}>
                      {tr('来源依据与购买记录')}
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    {detail.stats && (
                      <p>
                        {tr('共 ')}
                        {detail.stats.purchases} {tr(' 次购买 · 已知小计 ')}
                        {formatMoney(detail.stats.known_amount)} · {detail.stats.unknown_amounts}{' '}
                        {tr(' 项金额未知（不含退款分摊）')}
                      </p>
                    )}
                    {detail.sources.map((source: any) => {
                      const item = source.item_id
                        ? source.line_items?.find((i: any) => i.id === source.item_id)
                        : null;
                      const amount = source.item_id ? item?.amount : source.amount;
                      return (
                        <div className={styles.memoryRow} key={source.source_id + source.item_id}>
                          <div>
                            <strong>{source.title || source.source_type}</strong>
                            <p>
                              {source.date ? new Date(source.date).toLocaleDateString(locale) : ''} ·{' '}
                              {source.item_id ? item?.name || tr('商品明细') : tr('整单')} ·{' '}
                              {amount == null ? tr('金额未知') : formatMoney(Number(amount))}
                            </p>
                          </div>
                          {selected.kind === 'product' && (
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                const title = prompt(tr('拆分后的商品名称'), item?.name || selected.title);
                                if (title)
                                  run({
                                    operation: 'split',
                                    id: selected.id,
                                    version: selected.version,
                                    sourceId: source.source_id,
                                    itemId: source.item_id,
                                    value: { kind: 'product', title, attributes: selected.attributes },
                                  });
                              }}
                            >
                              {tr('拆为其他商品')}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <div className={styles.memoryActions}>
                      <Button
                        variant="primary"
                        type="button"
                        disabled={sourcePage === 1}
                        onClick={async () => {
                          try {
                            const next = sourcePage - 1;
                            setDetail(await api('?id=' + selected.id + '&page=' + next));
                            setSourcePage(next);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {tr('上一页来源')}
                      </Button>
                      <span>{sourcePage}</span>
                      <Button
                        variant="primary"
                        type="button"
                        disabled={detail.sources.length < 20}
                        onClick={async () => {
                          try {
                            const next = sourcePage + 1;
                            setDetail(await api('?id=' + selected.id + '&page=' + next));
                            setSourcePage(next);
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {tr('下一页来源')}
                      </Button>
                    </div>
                  </details>
                )}
                {selected.id && (
                  <details>
                    <summary className={styles.disclosure}>
                      {tr('合并与家庭分享')}
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    {selected.kind === 'product' && (
                      <>
                        <label>
                          {tr('搜索要合并到的商品')}
                          <Input value={targetQuery} onChange={e => setTargetQuery(e.target.value)} />
                        </label>
                        <label>
                          {tr('选择目标商品')}
                          <select value={target} onChange={e => setTarget(e.target.value)}>
                            <option value="">{tr('请选择')}</option>
                            {targets.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          variant="primary"
                          type="button"
                          disabled={busy || !target}
                          onClick={() => {
                            requestConfirmation(tr('将此商品的来源合并到目标商品？'), () =>
                              run({
                                operation: 'merge',
                                id: selected.id,
                                version: selected.version,
                                targetId: target,
                              }),
                            );
                          }}
                        >
                          {tr('合并商品')}
                        </Button>
                      </>
                    )}
                    <p className={styles.muted}>{tr('分享只发送下面确认的名称和描述，不复制私人来源。')}</p>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await fetch('/api/families');
                          const data = await r.json();
                          setFamilies(Array.isArray(data) ? data : data.families || []);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {tr('选择我的家庭')}
                    </Button>
                    {families.map(f => (
                      <Button
                        variant="primary"
                        type="button"
                        key={f.id}
                        disabled={busy}
                        onClick={() => {
                          requestConfirmation(tr('共享当前名称与描述给家庭 {0}？', [f.name]), () =>
                            run({
                              operation: 'share',
                              id: selected.id,
                              version: selected.version,
                              familyId: f.id,
                              shared: {
                                kind: selected.kind,
                                title: editTitle,
                                content: editContent,
                                aliases: [],
                                attributes: {},
                              },
                            }),
                          );
                        }}
                      >
                        {f.name}
                      </Button>
                    ))}
                  </details>
                )}
              </section>
            </Sheet>
          )}
        </div>
      )}
    </div>
  );
}
function MemoryModels() {
  const { t: tr, locale } = useI18n();
  const [role, setRole] = useState('embedding'),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function load() {
    setData(await api('?admin=models'));
  }
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);
  const cfg = data?.models.find((m: any) => m.role === role);
  return (
    <details>
      <summary>{tr('记忆模型配置与运行统计（管理员）')}</summary>
      <p>
        {tr('首次配置会复用现有通义连接，之后三个用途独立保存。更换记账密钥后，可用下方按钮同步当前用途。')}
      </p>
      <label>
        {tr('用途')}
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="embedding">{tr('向量嵌入')}</option>
          <option value="extraction">{tr('记忆提炼')}</option>
          <option value="judgment">{tr('候选判别')}</option>
        </select>
      </label>
      <form
        key={role + String(cfg?.version)}
        onSubmit={async e => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          try {
            await api('?admin=models', {
              role,
              base_url: f.get('base_url'),
              model: f.get('model'),
              key: f.get('key') || undefined,
              dimensions: Number(f.get('dimensions') || 1024),
            });
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tr('API 地址')}
          <Input name="base_url" type="url" required defaultValue={cfg?.base_url} />
        </label>
        <label>
          {tr('模型名称')}
          <Input name="model" required defaultValue={cfg?.model} />
        </label>
        <label>
          {tr('API 密钥（留空保留）')}
          <Input name="key" type="password" autoComplete="new-password" />
        </label>
        {role === 'embedding' && (
          <label>
            {tr('向量维度')}
            <Input
              name="dimensions"
              type="number"
              min={1}
              max={4096}
              defaultValue={cfg?.dimensions || 1024}
            />
          </label>
        )}
        <div className={styles.memoryActions}>
          <Button type="submit" variant="primary" disabled={busy}>
            {tr('保存配置')}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await api('?admin=models', { role, operation: 'reuse-key', source: 'recognition' });
                await load();
                setError(tr('已复用记账模型密钥，可测试连接并重试失败任务。'));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr('复用记账模型密钥')}
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api('?admin=models', { role, operation: 'test' });
                setError(tr('连接测试成功'));
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr('测试连接')}
          </Button>
        </div>
      </form>
      {error && <p role="status">{error}</p>}
      {data?.metrics.map((m: any) => (
        <p key={m.role}>
          {m.role}
          {tr('：近 7 天 ')}
          {m.calls} {tr(' 次，失败 ')}
          {m.failures} {tr(' 次，平均 ')}
          {m.latency_ms}ms，{m.tokens ?? tr('未知')} tokens
        </p>
      ))}
    </details>
  );
}
