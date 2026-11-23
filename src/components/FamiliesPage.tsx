'use client';
import { participantAvatar } from '@/ui/participantAvatar';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Segmented,
  Sheet,
  TextArea,
  useToast,
} from '@/ui';
import s from './FamiliesPage.module.css';
import { HomeFamilyInbox } from './HomeFamilyInbox';
import { FamilyFinance, FamilyOverview } from './FamilyFinance';
import { PagedList } from './PagedList';

import { useI18n } from './LanguageProvider';
import { useEffect, useState } from 'react';
import { Plus, Users, BookOpen, ArrowLeft, Link2, Settings2, Mail } from 'lucide-react';
import { Avatar, AvatarField } from './ManagementPages';
import { SymbolIcon } from './VisualSelect';
import { FormSelect } from './FormSelect';

type Person = { id: string; name: string; username: string; avatar?: string; disabled?: boolean };
type Family = {
  avatar: string;
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner_name?: string;
  member_count: number;
};
type Book = { id: string; name: string; icon: string; role?: string };
type Detail = Family & { members: Person[]; books: Book[]; availableBooks: Book[]; invitations: Person[] };
type Invite = { avatar: string; id: string; name: string; owner_name: string };
async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('/api/families' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || '操作未完成');
  return data;
}
export function FamiliesPage({
  userId,
  onChanged,
  onOpenBook,
  onManageBooks,
}: {
  userId: string;
  onChanged: () => Promise<void>;
  onOpenBook: (id: string) => void;
  onManageBooks: () => void;
}) {
  const { t: tr } = useI18n();
  const toast = useToast();
  const [revision, setRevision] = useState(0);
  async function refreshFinance() {
    setRevision(v => v + 1);
    await onChanged();
  }
  const [items, setItems] = useState<Family[]>([]),
    [invitations, setInvitations] = useState<Invite[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [edit, setEdit] = useState<'new' | 'edit' | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: () => Promise<void> } | null>(
    null,
  );
  const [manageSection, setManageSection] = useState<'members' | 'books' | 'access'>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [avatar, setAvatar] = useState('🏡'),
    [uploading, setUploading] = useState(false);
  const owner = detail?.owner_id === userId;
  async function load(id?: string, initial = false) {
    const d = await api('');
    setItems(d.items);
    setInvitations(d.invitations);
    if (initial) id = d.items[0]?.id;
    if (id && d.items.some((f: Family) => f.id === id)) setDetail(await api('/' + id));
    else setDetail(null);
  }
  useEffect(() => {
    load(undefined, true)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, method: string, body?: unknown, message = '已保存') {
    await api('/' + detail!.id + path, method, body);
    await load(detail!.id);
    await refreshFinance();
    toast.show(tr(message));
  }
  function ask(title: string, text: string, action: () => Promise<void>) {
    setConfirm({ title, text, action });
  }
  return (
    <div className={s.page}>
      <div className={s.heading}>
        <div>
          {detail && (
            <Button
              variant="ghost"
              onClick={() => {
                setDetail(null);
                setError('');
              }}
            >
              <ArrowLeft size={16} />
              {tr('所有家庭')}
            </Button>
          )}
          <h1>
            {detail && <Avatar value={detail.avatar} size={44} />} {detail?.name || tr('家庭管理')}
          </h1>
        </div>
        {!detail ? (
          <Button
            onClick={() => {
              setAvatar('🏡');
              setEdit('new');
            }}
          >
            <Plus size={18} />
            {tr('创建家庭')}
          </Button>
        ) : (
          owner && (
            <Button
              variant="secondary"
              onClick={() => {
                setAvatar(detail!.avatar || '🏡');
                setEdit('edit');
              }}
            >
              <Settings2 size={17} />
              {tr('家庭资料')}
            </Button>
          )
        )}
      </div>
      {error && (
        <p className={s.error} role="alert">
          {tr(error)}
        </p>
      )}
      {detail && <FamilyOverview key={detail.id} family={detail.id} revision={revision} />}
      {!loading && <HomeFamilyInbox compact={false} revision={revision} onChanged={refreshFinance} />}
      {invitations.length > 0 && (
        <Card>
          <h2>
            <Mail size={21} />
            {tr('待处理邀请')} <Chip tone="attention">{invitations.length}</Chip>
          </h2>
          {
            <PagedList items={invitations}>
              {i => (
                <div className={s.row} key={i.id}>
                  <Avatar value={i.avatar} size={44} />
                  <span>
                    <strong>{i.name}</strong>
                    <small>
                      {i.owner_name} {tr('邀请你加入')}
                    </small>
                  </span>
                  <div className={s.actions}>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        ask('加入家庭', tr('加入「{0}」？', [i.name]), async () => {
                          await api('/' + i.id + '/invitation', 'POST', { accept: true });
                          await load(i.id);
                          toast.show(tr('已加入家庭；账本由所有者单独授权。'));
                        })
                      }
                    >
                      {tr('加入家庭')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api('/' + i.id + '/invitation', 'POST', { accept: false });
                          await load(detail?.id);
                        })
                      }
                    >
                      {tr('婉拒')}
                    </Button>
                  </div>
                </div>
              )}
            </PagedList>
          }
        </Card>
      )}
      {loading ? (
        <p role="status">{tr('正在读取家庭…')}</p>
      ) : !detail ? (
        <>
          <div className={s.grid}>
            {
              <PagedList items={items}>
                {f => (
                  <Button
                    className={s.family}
                    key={f.id}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await load(f.id);
                      })
                    }
                  >
                    <Avatar value={f.avatar} size={64} />
                    <strong>{f.name}</strong>
                    <small>
                      {f.member_count}
                      {tr('位成员 ·')}
                      {f.owner_id === userId ? tr('我是负责人') : tr('家庭成员')}
                    </small>
                    {f.description && <p>{f.description}</p>}
                    <span className={s.link}>{tr('查看家庭 →')}</span>
                  </Button>
                )}
              </PagedList>
            }
          </div>
          {!items.length && (
            <Card>
              <EmptyState
                title={tr('为共同生活建一个家庭')}
                action={
                  <Button
                    onClick={() => {
                      setAvatar('🏡');
                      setEdit('new');
                    }}
                  >
                    {tr('创建我的家庭')}
                  </Button>
                }
              >
                {tr('你可以独立使用账号，也可以创建家庭或接受邀请。')}
              </EmptyState>
            </Card>
          )}
        </>
      ) : (
        <>
          <FamilyFinance
            key={detail.id}
            family={detail.id}
            userId={userId}
            onChanged={refreshFinance}
            revision={revision}
            showOverviewTab={false}
          />
          {detail.description && <p className={s.muted}>{detail.description}</p>}
          <Segmented
            label={tr('家庭管理')}
            value={manageSection}
            onChange={v => setManageSection(v as 'members' | 'books' | 'access')}
            options={[
              { value: 'members', label: `${tr('家庭成员')} (${detail.members.length})` },
              { value: 'books', label: `${tr('家庭账本')} (${detail.books.length})` },
              ...(detail.books.some((b: any) => b.role === 'owner') || owner
                ? [{ value: 'access', label: tr('权限与设置') }]
                : []),
            ]}
          />
          {manageSection === 'members' && (
            <Card>
              <div className={s.heading}>
                <h2>
                  <Users size={21} />
                  {tr('家庭成员')}
                </h2>
                {owner && (
                  <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
                    <Plus size={16} />
                    {tr('邀请成员')}
                  </Button>
                )}
              </div>
              {
                <PagedList items={detail.members}>
                  {m => (
                    <div className={s.row} key={m.id}>
                      <Avatar value={participantAvatar(m.avatar)} />
                      <span>
                        <strong>
                          {m.name}
                          {m.id === userId ? tr('（我）') : ''}
                        </strong>
                        <small>
                          @{m.username} · {m.id === detail.owner_id ? tr('家庭负责人') : tr('家庭成员')}
                          {m.disabled ? tr(' · 账号已停用') : ''}
                        </small>
                      </span>
                      {owner && m.id !== userId && (
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            ask(
                              '移出家庭',
                              tr(
                                '将{0}移出家庭。其独立账号保留，名下账本将解除家庭关联。已单独授予的账本权限仍保留，可在账本管理中撤销。',
                                [m.name],
                              ),
                              async () => mutate('/members', 'DELETE', { userId: m.id }, '已移出家庭'),
                            )
                          }
                        >
                          {tr('移出')}
                        </Button>
                      )}
                    </div>
                  )}
                </PagedList>
              }
              {owner && detail.invitations.length > 0 && (
                <div className={s.pending}>
                  <h3>{tr('等待接受')}</h3>
                  <PagedList items={detail.invitations}>
                    {i => (
                      <div className={s.row} key={i.id}>
                        <span>
                          {i.name}
                          <small>@{i.username}</small>
                        </span>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            ask('撤回', tr('撤回发给 {0} 的邀请？', [i.name]), () =>
                              mutate('/invitations', 'DELETE', { userId: i.id }, '已撤回邀请'),
                            )
                          }
                        >
                          {tr('撤回')}
                        </Button>
                      </div>
                    )}
                  </PagedList>
                </div>
              )}
            </Card>
          )}
          {manageSection === 'books' && (
            <Card>
              <div className={s.heading}>
                <h2>
                  <BookOpen size={21} />
                  {tr('家庭账本')}
                </h2>
                <Button variant="ghost" onClick={onManageBooks}>
                  {tr('管理账本')}
                </Button>
              </div>
              {detail.books.length ? (
                <PagedList items={detail.books}>
                  {b => (
                    <div className={s.row} key={b.id}>
                      <SymbolIcon icon={b.icon || '📒'} size={38} />
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.role === 'owner'
                            ? tr('我是账本所有者')
                            : b.role === 'editor'
                              ? tr('可记账')
                              : tr('只读')}
                        </small>
                      </span>
                      <div className={s.actions}>
                        <Button variant="secondary" onClick={() => onOpenBook(b.id)}>
                          {tr('打开')}
                        </Button>
                        {(owner || b.role === 'owner') && (
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              ask(
                                '解除账本关联',
                                tr('“{0}”将移出此家庭，账目和已有账本权限保持不变。', [b.name]),
                                async () => mutate('/books', 'DELETE', { bookId: b.id }, '已解除关联'),
                              )
                            }
                          >
                            {tr('解除关联')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </PagedList>
              ) : (
                <p className={s.muted}>{tr('暂无已授权给你的家庭账本。')}</p>
              )}
              {detail.availableBooks.length > 0 ? (
                <form
                  className={s.form}
                  onSubmit={e => {
                    e.preventDefault();
                    const bookId = String(new FormData(e.currentTarget).get('bookId'));
                    run(() => mutate('/books', 'POST', { bookId }, '已关联账本，成员权限仍需单独设置'));
                  }}
                >
                  <label>
                    {tr('关联我的共享账本')}
                    <FormSelect name="bookId">
                      {detail.availableBooks.map(b => (
                        <option value={b.id} key={b.id} data-icon={b.icon || '📒'}>
                          {b.name}
                        </option>
                      ))}
                    </FormSelect>
                  </label>
                  <Button type="submit" disabled={busy}>
                    <Link2 size={17} />
                    {tr('关联')}
                  </Button>
                </form>
              ) : (
                <Button variant="secondary" onClick={onManageBooks}>
                  <Plus size={17} />
                  {tr('前往创建共享账本')}
                </Button>
              )}
            </Card>
          )}
          {manageSection === 'access' && (
            <Card>
              {detail.books.some(b => b.role === 'owner') && detail.members.some(m => m.id !== userId) && (
                <div className={s.details}>
                  <h3>{tr('为家庭成员设置账本权限')}</h3>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const values = Object.fromEntries(new FormData(e.currentTarget));
                      const member = detail.members.find(m => m.id === values.userId)!;
                      const book = detail.books.find(b => b.id === values.bookId)!;
                      const role =
                        values.role === 'editor'
                          ? tr('可记账')
                          : values.role === 'viewer'
                            ? tr('只读')
                            : tr('撤销访问');
                      ask(
                        '保存账本权限',
                        tr('将{0}对「{1}」的权限设为「{2}」？', [member.name, book.name, role]),
                        () => mutate('/access', 'PUT', values, '账本权限已更新'),
                      );
                    }}
                  >
                    <label>
                      {tr('账本')}
                      <FormSelect name="bookId">
                        {detail.books
                          .filter(b => b.role === 'owner')
                          .map(b => (
                            <option value={b.id} key={b.id} data-icon={b.icon || '📒'}>
                              {b.name}
                            </option>
                          ))}
                      </FormSelect>
                    </label>
                    <label>
                      {tr('成员')}
                      <FormSelect name="userId">
                        {detail.members
                          .filter(m => m.id !== userId)
                          .map(m => (
                            <option key={m.id} value={m.id} data-icon={participantAvatar(m.avatar)}>
                              {tr('{0}（{1}）', [m.name, m.username])}
                            </option>
                          ))}
                      </FormSelect>
                    </label>
                    <label>
                      {tr('权限')}
                      <FormSelect name="role">
                        <option value="viewer">{tr('只读')}</option>
                        <option value="editor">{tr('可记账')}</option>
                        <option value="none">{tr('撤销访问')}</option>
                      </FormSelect>
                    </label>
                    <Button type="submit" variant="primary" disabled={busy}>
                      {tr('保存账本权限')}
                    </Button>
                  </form>
                </div>
              )}
              <div className={s.details}>
                <h3>{owner ? tr('转交或解散家庭') : tr('退出家庭')}</h3>
                {owner ? (
                  <>
                    <form
                      className={s.form}
                      onSubmit={e => {
                        e.preventDefault();
                        const userId = String(new FormData(e.currentTarget).get('userId'));
                        ask(
                          '转交家庭负责人',
                          '转交后你将成为普通家庭成员。账本所有权不会随之变更。',
                          async () => mutate('/owner', 'PUT', { userId }, '家庭负责人已转交'),
                        );
                      }}
                    >
                      <label>
                        {tr('新负责人')}
                        <FormSelect
                          name="userId"
                          disabled={!detail.members.some(m => m.id !== userId && !m.disabled)}
                        >
                          {detail.members
                            .filter(m => m.id !== userId && !m.disabled)
                            .map(m => (
                              <option key={m.id} value={m.id} data-icon={participantAvatar(m.avatar)}>
                                {m.name}
                              </option>
                            ))}
                        </FormSelect>
                      </label>
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={busy || !detail.members.some(m => m.id !== userId && !m.disabled)}
                      >
                        {tr('转交家庭')}
                      </Button>
                    </form>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        ask(
                          '解散家庭',
                          '解散后家庭成员关系与邀请将移除。所有账号、账本、账目和账本授权保留。',
                          async () => mutate('', 'DELETE', undefined, '家庭已解散，账本和账号保留'),
                        )
                      }
                    >
                      {tr('解散家庭')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      ask(
                        '退出家庭',
                        '你的账号和账本保留，名下账本会解除家庭关联；已有账本访问权限需单独管理。',
                        async () => mutate('/members', 'DELETE', { userId }, '已退出家庭'),
                      )
                    }
                  >
                    {tr('退出家庭')}
                  </Button>
                )}
              </div>
            </Card>
          )}
          {inviteOpen && owner && (
            <Sheet
              open
              closeLabel={tr('关闭弹窗')}
              title={tr('邀请成员')}
              onClose={() => {
                if (!busy) setInviteOpen(false);
              }}
            >
              <form
                className={s.form}
                onSubmit={e => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const username = String(new FormData(form).get('username'));
                  ask('发送邀请', tr('邀请 {0} 加入家庭？', [username]), async () => {
                    await mutate('/invitations', 'POST', { username }, '邀请已发送，等待对方登录后接受');
                    form.reset();
                    setInviteOpen(false);
                  });
                }}
              >
                <Field label={tr('邀请已有账号')}>
                  {control => (
                    <Input
                      {...control}
                      name="username"
                      placeholder={tr('输入登录账号')}
                      required
                      maxLength={80}
                    />
                  )}
                </Field>
                <Button type="submit" variant="primary" disabled={busy}>
                  {tr('发送邀请')}
                </Button>
              </form>
            </Sheet>
          )}
        </>
      )}

      {edit && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={edit === 'new' ? tr('创建家庭') : tr('家庭资料')}
          onClose={() => {
            if (!busy && !uploading) setEdit(null);
          }}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              if (uploading) return;
              const values = { ...Object.fromEntries(new FormData(e.currentTarget)), avatar };
              run(async () => {
                if (edit === 'new') {
                  const d = await api('', 'POST', values);
                  await load(d.id);
                } else {
                  await api('/' + detail!.id, 'PUT', values);
                  await load(detail!.id);
                }
                setEdit(null);
              });
            }}
          >
            <AvatarField value={avatar} onChange={setAvatar} onProcessing={setUploading} />
            <Field label={tr('家庭名称')}>
              {control => (
                <Input
                  {...control}
                  name="name"
                  defaultValue={edit === 'edit' ? detail?.name : ''}
                  maxLength={80}
                  required
                  placeholder={tr('例如：我们的小家')}
                />
              )}
            </Field>
            <Field label={tr('家庭简介（选填）')}>
              {control => (
                <TextArea
                  {...control}
                  name="description"
                  defaultValue={edit === 'edit' ? detail?.description : ''}
                  maxLength={500}
                />
              )}
            </Field>
            {error && <p className={s.error}>{tr(error)}</p>}
            <Button type="submit" variant="primary" disabled={busy || uploading}>
              {tr('保存家庭')}
            </Button>
          </form>
        </Sheet>
      )}
      {confirm && (
        <ConfirmDialog
          open
          busy={busy}
          title={tr(confirm.title)}
          confirmLabel={tr('确认') + tr(confirm.title)}
          onCancel={() => {
            if (!busy) setConfirm(null);
          }}
          onConfirm={() =>
            run(async () => {
              await confirm.action();
              setConfirm(null);
            })
          }
        >
          <p>{tr(confirm.text)}</p>
          {error && (
            <p role="alert" className={s.error}>
              {tr(error)}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
