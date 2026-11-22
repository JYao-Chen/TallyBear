'use client';
import { Button, Card, Field, Input, ListRow, Segmented, Sheet, TextArea } from '@/ui';
import styles from './ManagementPages.module.css';
import { useConfirmation } from '@/ui/useConfirmation';
import { PersonalProfile } from './PersonalProfile';
import { PagedList } from './PagedList';

import { useI18n } from './LanguageProvider';
import { FormSelect } from './FormSelect';

import { compressAvatar } from '@/lib/avatar-image';
import { useTheme } from './ThemeProvider';
import { themes, type Theme } from '@/lib/themes';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  Check,
  Settings2,
  MessagesSquare,
  ScanLine,
  UserRound,
} from 'lucide-react';
import { SymbolIcon, StickerPicker } from './VisualSelect';
export type ManagedUser = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  admin: boolean;
  disabled?: boolean;
  theme?: Theme;
};
export type ManagedBook = {
  id: string;
  name: string;
  icon: string;
  description: string;
  kind: string;
  role: string;
  family_name?: string | null;
};
async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error);
  return d;
}
export function Avatar({ value, size = 40 }: { value?: string; size?: number }) {
  const { t: tr, locale } = useI18n();
  return (
    <span className={styles.profileAvatar} style={{ width: size, height: size }}>
      {value?.startsWith('data:image/') ? (
        <img src={value} width={size} height={size} alt="" />
      ) : !value || value === '🧸' ? (
        <UserRound size={Math.round(size * 0.62)} aria-hidden />
      ) : (
        <SymbolIcon icon={value} size={size} fallback="user" />
      )}
    </span>
  );
}
export function BookSwitcher({
  books,
  current,
  onSelect,
  onManage,
}: {
  books: ManagedBook[];
  current: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const { t: tr, locale } = useI18n();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState('');
  const selected = books.find(b => b.id === current);
  return (
    <>
      <Button
        className={styles.bookSwitchTrigger}
        aria-label={tr('切换账本')}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <SymbolIcon icon={selected?.icon || '📒'} size={32} />
        <span>
          <strong>{selected?.name || tr('选择账本')}</strong>
          <small>{selected?.kind === 'private' ? tr('私人空间') : tr('共享账本')}</small>
        </span>
        <ChevronDown size={16} />
      </Button>
      {open && (
        <Sheet open closeLabel={tr('关闭弹窗')} title={tr('切换账本')} onClose={() => setOpen(false)}>
          <Input
            className={styles.search}
            placeholder={tr('搜索账本')}
            aria-label={tr('搜索账本')}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <div className={styles.bookSwitchList}>
            {
              <PagedList items={books.filter(b => b.name.includes(q))} resetKey={q}>
                {b => (
                  <Button
                    key={b.id}
                    onClick={() => {
                      onSelect(b.id);
                      setOpen(false);
                    }}
                  >
                    <SymbolIcon icon={b.icon || '📒'} size={44} />
                    <span>
                      <strong>{b.name}</strong>
                      <small>
                        {b.kind === 'private' ? tr('仅自己可见') : tr('已授权成员共享')} ·{' '}
                        {b.role === 'viewer' ? tr('只读') : tr('可记账')}
                      </small>
                    </span>
                    {b.id === current && <Check size={18} />}
                  </Button>
                )}
              </PagedList>
            }
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              onManage();
            }}
          >
            <Settings2 size={18} />
            {tr('管理所有账本')}
          </Button>
        </Sheet>
      )}
    </>
  );
}
export function AvatarField({
  value,
  onChange,
  onProcessing,
}: {
  value: string;
  onChange: (s: string) => void;
  onProcessing: (v: boolean) => void;
}) {
  const { t: tr, locale } = useI18n();
  const [gallery, setGallery] = useState(false),
    [error, setError] = useState(''),
    [processing, setProcessing] = useState(false);
  return (
    <>
      <div className={styles.avatarEdit}>
        <Avatar value={value} size={76} />
        <div>
          <label className={styles.avatarUpload}>
            {processing ? tr('正在压缩图片…') : tr('上传头像')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={processing}
              onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setError('');
                setProcessing(true);
                onProcessing(true);
                try {
                  onChange(await compressAvatar(f));
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setProcessing(false);
                  onProcessing(false);
                }
              }}
            />
          </label>
          <Button variant="ghost" type="button" disabled={processing} onClick={() => setGallery(v => !v)}>
            {gallery ? tr('收起表情库') : tr('从表情库选择')}
          </Button>
        </div>
      </div>
      {processing && <p role="status">{tr('正在优化头像，请稍候…')}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {tr(error)}
        </p>
      )}
      {gallery && !processing && (
        <StickerPicker value={value.startsWith('data:') ? '🧸' : value} onChange={onChange} />
      )}
    </>
  );
}
export function ProfilePage({
  user,
  onSaved,
  memoryRequest,
}: {
  user: ManagedUser;
  onSaved: () => Promise<void>;
  memoryRequest?: { id: string; key: number } | null;
}) {
  const { t: tr, locale } = useI18n();
  const [tab, setTab] = useState(memoryRequest ? 'memory' : 'account');
  useEffect(() => {
    if (memoryRequest) setTab('memory');
  }, [memoryRequest]);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<'profile' | 'password' | null>(null);
  const { theme, setTheme } = useTheme();
  const [avatar, setAvatar] = useState(user.avatar || '🧸'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      setEditing(null);
      setMessage('已保存');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{tr('个人资料')}</h1>
      <nav className={styles.profileTabs} aria-label={tr('个人资料栏目')}>
        <Segmented
          tabs
          label={tr('个人资料栏目')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'account', label: tr('账号资料') },
            { value: 'theme', label: tr('外观主题') },
            { value: 'memory', label: tr('个人画像') },
          ]}
        />
      </nav>
      {tab === 'memory' && (
        <PersonalProfile
          admin={user.admin}
          initialId={memoryRequest?.id}
          key={memoryRequest?.key || 'memory'}
        />
      )}{' '}
      {tab === 'theme' && (
        <Card title={tr('外观主题')}>
          <Segmented
            className={styles.themePicker}
            label={tr('外观主题')}
            value={theme}
            options={(Object.keys(themes) as Theme[]).map(value => ({
              value,
              label: tr(themes[value].label),
              disabled: busy,
            }))}
            onChange={key =>
              run(async () => {
                setTheme(key);
                try {
                  await api('me', 'PATCH', { theme: key });
                } catch (error) {
                  setTheme(theme);
                  throw error;
                }
                await onSaved();
              })
            }
          />
          <p>{theme === 'bear' ? tr('暖色 · 小熊插图') : tr('冷白 · 简洁图标')}</p>
        </Card>
      )}
      {tab === 'account' && (
        <div className={styles.settingsGrid}>
          <Card className={styles.accountRows}>
            <ListRow
              aria-label={tr('我在账本里的样子') + ' · ' + user.name}
              leading={<Avatar value={user.avatar} />}
              title={user.name}
              meta={user.username}
              end={<ChevronRight size={18} aria-hidden="true" />}
              onClick={() => {
                setMessage('');
                setAvatar(user.avatar);
                setEditing('profile');
              }}
            />
            <Sheet
              open={editing === 'profile'}
              title={tr('我在账本里的样子')}
              onClose={() => {
                if (!busy && !uploading) setEditing(null);
              }}
            >
              <form
                className={styles.sheetForm}
                onSubmit={e => {
                  e.preventDefault();
                  if (uploading) return;
                  const f = new FormData(e.currentTarget);
                  run(async () => {
                    await api('me', 'PUT', { name: f.get('name'), avatar });
                    await onSaved();
                  });
                }}
              >
                <AvatarField value={avatar} onChange={setAvatar} onProcessing={setUploading} />
                <Field label={tr('登录账号')}>
                  {control => <Input {...control} value={user.username} readOnly />}
                </Field>
                <Field label={tr('显示名称')}>
                  {control => (
                    <Input {...control} name="name" maxLength={80} defaultValue={user.name} required />
                  )}
                </Field>
                <Button type="submit" variant="primary" disabled={busy || uploading}>
                  {tr('保存个人资料')}
                </Button>
              </form>
              {message && <p role="status">{tr(message)}</p>}
            </Sheet>
            <ListRow
              leading={<LockKeyhole size={20} aria-hidden="true" />}
              title={<span className={styles.passwordTitle}>{tr('登录与密码')}</span>}
              end={
                <span className={styles.rowAction}>
                  {tr('修改密码')} <ChevronRight size={18} aria-hidden="true" />
                </span>
              }
              onClick={() => {
                setMessage('');
                setAvatar(user.avatar);
                setEditing('password');
              }}
            />
            <Sheet
              open={editing === 'password'}
              title={tr('登录与密码')}
              onClose={() => {
                if (!busy && !uploading) setEditing(null);
              }}
            >
              <form
                className={styles.sheetForm}
                onSubmit={e => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(async () => {
                    await api('password', 'PUT', Object.fromEntries(f));
                  });
                }}
              >
                <Field label={tr('当前密码')}>
                  {control => (
                    <Input
                      {...control}
                      name="oldPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  )}
                </Field>
                <label>
                  {tr('新密码')}
                  <Input
                    name="newPassword"
                    type="password"
                    minLength={8}
                    placeholder={tr('密码至少 8 位')}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <Button type="submit" variant="primary" disabled={busy}>
                  {tr('修改密码')}
                </Button>
              </form>
              {message && <p role="status">{tr(message)}</p>}
            </Sheet>
          </Card>
        </div>
      )}
      {message && !editing && (
        <p className={styles.notice} role="status">
          {tr(message)}
        </p>
      )}
    </>
  );
}
export function UsersPage() {
  const { t: tr, locale } = useI18n();
  const { confirmation, requestConfirmation } = useConfirmation();
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [selected, setSelected] = useState<ManagedUser | null>(null),
    [avatar, setAvatar] = useState('🧸'),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function load() {
    setUsers(await api('users'));
  }
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);
  return (
    <>
      {confirmation}
      <h1>{tr('用户管理')}</h1>
      {error && <p className={styles.error}>{tr(error)}</p>}
      <Card>
        <div className={styles.panelTitle}>
          <h2>{tr('独立用户账号')}</h2>
          <Button
            variant="primary"
            onClick={() => {
              setSelected(null);
              setOpen(true);
              setAvatar('🧸');
            }}
          >
            {tr('创建账号')}
          </Button>
        </div>
        {
          <PagedList items={users}>
            {u => (
              <ListRow
                key={u.id}
                onClick={() => {
                  setSelected(u);
                  setAvatar(u.avatar);
                  setOpen(true);
                }}
                leading={<Avatar value={u.avatar} />}
                title={u.name}
                meta={
                  <>
                    @{u.username} · {u.admin ? tr('系统管理员') : tr('普通用户')}
                    {u.disabled ? tr(' · 已停用') : ''}
                  </>
                }
                end="›"
              />
            )}
          </PagedList>
        }
      </Card>
      {open && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={selected ? tr('管理用户') : tr('创建用户')}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className={styles.sheetForm}
            onSubmit={async e => {
              e.preventDefault();
              if (uploading) return;
              const f = new FormData(e.currentTarget);
              const save = async () => {
                setBusy(true);
                setError('');

                try {
                  if (selected)
                    await api('users', 'PATCH', {
                      id: selected.id,
                      name: f.get('name'),
                      avatar,
                      disabled: f.get('disabled') === 'on',
                      ...(f.get('password') ? { password: f.get('password') } : {}),
                    });
                  else await api('users', 'POST', { ...Object.fromEntries(f), avatar });
                  await load();
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              };
              const disabled = f.get('disabled') === 'on';
              if (selected && (f.get('password') || disabled !== !!selected.disabled)) {
                const changes = [
                  f.get('password') && tr('重设密码'),
                  disabled !== !!selected.disabled &&
                    (disabled ? tr('停用账号，并退出其所有设备') : tr('启用账号')),
                ].filter(Boolean);
                requestConfirmation(
                  <>
                    {selected.name} · {changes.join(' · ')}
                  </>,
                  save,
                );
              } else await save();
            }}
          >
            <AvatarField value={avatar} onChange={setAvatar} onProcessing={setUploading} />
            <label>
              {tr('登录账号')}
              <Input
                name="username"
                defaultValue={selected?.username}
                readOnly={!!selected}
                required
                maxLength={80}
              />
            </label>
            <Field label={tr('显示名称')}>
              {control => (
                <Input {...control} name="name" defaultValue={selected?.name} required maxLength={80} />
              )}
            </Field>
            <label>
              {selected ? tr('重设密码（留空保持原密码）') : tr('初始密码')}
              <Input
                name="password"
                type="password"
                minLength={8}
                placeholder={tr('密码至少 8 位')}
                autoComplete="new-password"
                required={!selected}
              />
            </label>
            {selected && (
              <label className={styles.check}>
                <input type="checkbox" name="disabled" defaultChecked={selected.disabled} />
                {tr('停用账号，并退出其所有设备')}
              </label>
            )}
            {error && <p className={styles.error}>{tr(error)}</p>}
            <Button type="submit" variant="primary" disabled={busy || uploading}>
              {tr('保存用户')}
            </Button>
          </form>
        </Sheet>
      )}
    </>
  );
}
export function BooksPage({
  books,
  onSaved,
  onSelect,
}: {
  books: ManagedBook[];
  onSaved: () => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const { t: tr, locale } = useI18n();
  const { confirmation, requestConfirmation } = useConfirmation();
  const [selected, setSelected] = useState<ManagedBook | null>(null),
    [open, setOpen] = useState(false),
    [icon, setIcon] = useState('📒'),
    [gallery, setGallery] = useState(false),
    [members, setMembers] = useState<{ id: string; name: string; username: string; role: string }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function manage(b: ManagedBook | null) {
    setSelected(b);
    setIcon(b?.icon || '📒');
    setGallery(false);
    setMembers([]);
    setError('');
    setOpen(true);
    if (b)
      try {
        setMembers(await api(`books/${b.id}/members`));
      } catch (e) {
        setError((e as Error).message);
      }
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {confirmation}
      <div className={styles.panelTitle}>
        <h1>{tr('账本管理')}</h1>
        <Button variant="primary" onClick={() => manage(null)}>
          {tr('新建账本')}
        </Button>
      </div>
      <div className={styles.bookManagementGrid}>
        {
          <PagedList items={books}>
            {b => (
              <Card key={b.id}>
                <ListRow
                  leading={<SymbolIcon icon={b.icon || '📒'} size={40} />}
                  title={b.name}
                  meta={[b.family_name, b.description || tr('还没有填写账本用途')]
                    .filter(Boolean)
                    .join(' · ')}
                  end={<>{b.kind === 'private' ? tr('私人账本') : tr('共享账本')} ›</>}
                  onClick={() => manage(b)}
                />
                <div className={styles.sheetActions}>
                  <Button onClick={() => manage(b)}>{tr('资料与成员')}</Button>
                  <Button variant="primary" onClick={() => onSelect(b.id)}>
                    {tr('打开账本')}
                  </Button>
                </div>
              </Card>
            )}
          </PagedList>
        }
      </div>
      {open && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={selected ? tr('账本资料与成员') : tr('准备一本新账本')}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {error && <p className={styles.error}>{tr(error)}</p>}
          <form
            className={styles.sheetForm}
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                if (selected)
                  await api(`books/${selected.id}/metadata`, 'PUT', { ...Object.fromEntries(f), icon });
                else await api('books', 'POST', Object.fromEntries(f));
                setOpen(false);
              });
            }}
          >
            <fieldset disabled={(!!selected && selected.role !== 'owner') || busy}>
              {selected && (
                <>
                  <Button type="button" onClick={() => setGallery(v => !v)}>
                    <SymbolIcon icon={icon} />
                    {tr('更换账本图标')}
                  </Button>
                  {gallery && <StickerPicker value={icon} onChange={setIcon} />}
                </>
              )}
              <Field label={tr('账本名称')}>
                {control => (
                  <Input {...control} name="name" defaultValue={selected?.name} required maxLength={80} />
                )}
              </Field>
              {selected && (
                <label>
                  {tr('用途说明')}
                  <TextArea name="description" defaultValue={selected.description} maxLength={500} />
                </label>
              )}
              <label>
                {tr('可见范围')}
                <FormSelect name="kind" defaultValue={selected?.kind || 'private'}>
                  <option value="private">{tr('私人：仅自己可见')}</option>
                  <option value="shared">{tr('共享：授权成员可见')}</option>
                </FormSelect>
              </label>
              <Button type="submit" variant="primary">
                {tr('保存账本')}
              </Button>
            </fieldset>
          </form>
          {selected && (
            <section className={styles.settingsSection}>
              <h3>{tr('账本成员')}</h3>
              {
                <PagedList items={members}>
                  {m => (
                    <div className={styles.memberRow} key={m.id}>
                      <span>
                        {m.name} ·{' '}
                        {m.role === 'owner' ? tr('所有者') : m.role === 'viewer' ? tr('只读') : tr('可记账')}
                      </span>
                      {selected.role === 'owner' && m.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            requestConfirmation(
                              <>
                                {' '}
                                {tr('移除')} · {m.name}
                              </>,
                              () =>
                                run(async () => {
                                  await api(`books/${selected.id}/members`, 'DELETE', { id: m.id });
                                  setMembers(await api(`books/${selected.id}/members`));
                                }),
                            )
                          }
                        >
                          {tr('移除')}
                        </Button>
                      )}
                    </div>
                  )}
                </PagedList>
              }
              {selected.role === 'owner' && selected.kind === 'shared' && (
                <form
                  className={styles.sheetForm}
                  onSubmit={e => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    requestConfirmation(
                      <>
                        {tr('授权 / 更新权限')} · {String(f.get('username'))} ·{' '}
                        {f.get('role') === 'editor' ? tr('可记账') : tr('只读')}
                      </>,
                      () =>
                        run(async () => {
                          await api(`books/${selected.id}/members`, 'POST', Object.fromEntries(f));
                          setMembers(await api(`books/${selected.id}/members`));
                        }),
                    );
                  }}
                >
                  <Field label={tr('成员账号')}>
                    {control => <Input {...control} name="username" required />}
                  </Field>
                  <label>
                    {tr('权限')}
                    <FormSelect name="role">
                      <option value="editor">{tr('可记账')}</option>
                      <option value="viewer">{tr('只读')}</option>
                    </FormSelect>
                  </label>
                  <Button type="submit" variant="primary" disabled={busy}>
                    {tr('授权 / 更新权限')}
                  </Button>
                </form>
              )}
            </section>
          )}
        </Sheet>
      )}
    </>
  );
}

export type ModelConfig = {
  baseUrl: string;
  model: string;
  visionModel: string;
  key: string;
  hasKey: boolean;
};

export function ModelSettingsPanel({
  scope,
  config,
  onSave,
  onTest,
}: {
  scope: 'recognition' | 'assistant';
  config: ModelConfig;
  onSave: (value: ModelConfig) => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const [draft, setDraft] = useState<ModelConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tested, setTested] = useState(false);
  const assistant = scope === 'assistant',
    Icon = assistant ? MessagesSquare : ScanLine;
  const title = tr(assistant ? 'AI 助手模型' : '账单识别模型');
  async function submit(action: () => Promise<void>, closeOnSuccess: boolean) {
    setBusy(true);
    setTested(false);
    setError('');
    try {
      await action();
      if (closeOnSuccess) setDraft(null);
      else setTested(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <ListRow
        leading={<Icon size={20} />}
        title={title}
        end={<>{config.model || tr('尚未配置')} ›</>}
        onClick={() => {
          setError('');
          setTested(false);
          setDraft({ ...config });
        }}
      />
      {draft && (
        <Sheet
          open
          title={title}
          onClose={() => {
            if (!busy) setDraft(null);
          }}
        >
          {tested && (
            <p role="status" className={styles.notice}>
              {tr(
                assistant
                  ? 'AI 助手模型连接测试已提交，请在后台任务查看结果'
                  : '账单识别模型连接测试已提交，请在后台任务查看结果',
              )}
            </p>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {tr(error)}
            </p>
          )}
          <p className={styles.muted}>
            {tr(
              assistant
                ? '用于小熊对话的问答、工具调用，以及对话内的图片识别与后续核对。'
                : '用于“记一笔”中的 AI 文字／截图识别，不影响小熊对话。',
            )}
          </p>
          <form
            className={styles.sheetForm}
            onSubmit={e => {
              e.preventDefault();
              void submit(() => onSave(draft), true);
            }}
          >
            <label>
              {tr('兼容接口地址')}
              <Input
                value={draft.baseUrl}
                onChange={e => setDraft({ ...draft, baseUrl: e.target.value })}
                required
              />
            </label>
            <label>
              {tr('文字模型')}
              <Input
                value={draft.model}
                onChange={e => setDraft({ ...draft, model: e.target.value })}
                placeholder={tr('填写供应商模型名称')}
                required
              />
            </label>
            <label>
              {tr('图片模型')}
              <Input
                value={draft.visionModel}
                onChange={e => setDraft({ ...draft, visionModel: e.target.value })}
                required
              />
            </label>
            <label>
              API Key
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={config.hasKey ? tr('已保存，留空保持不变') : tr('尚未配置')}
                value={draft.key}
                onChange={e => setDraft({ ...draft, key: e.target.value })}
              />
            </label>
            <div className={styles.sheetActions}>
              <Button type="submit" variant="primary" disabled={busy}>
                {tr(assistant ? '保存助手模型' : '保存识别模型')}
              </Button>
              <Button disabled={busy} onClick={() => submit(onTest, false)}>
                {tr('测试已保存的连接')}
              </Button>
            </div>
          </form>
        </Sheet>
      )}
    </Card>
  );
}
