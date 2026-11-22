'use client';
import { Button, Card, ConfirmDialog, Input, Sheet } from '@/ui';
import styles from './CategoryPanel.module.css';
import { useConfirmation } from '@/ui/useConfirmation';
import { PagedList } from './PagedList';

import { useI18n } from './LanguageProvider';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Trash2, GripVertical } from 'lucide-react';
import { SymbolIcon, StickerPicker } from './VisualSelect';
export type Category = { name: string; icon: string; archived: boolean };
export function CategoryPanel({
  items,
  canWrite,
  onSave,
}: {
  items: Category[];
  canWrite: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const { t: tr } = useI18n();
  const { confirmation, requestConfirmation } = useConfirmation();
  const [editing, setEditing] = useState<Category | null>(null),
    [open, setOpen] = useState(false),
    [all, setAll] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [icon, setIcon] = useState('🧸'),
    [deleting, setDeleting] = useState<Category | null>(null),
    [order, setOrder] = useState<Category[] | null>(null),
    [dragged, setDragged] = useState<string | null>(null);
  function edit(c: Category | null) {
    setEditing(c);
    setIcon(c?.icon || 'sticker:001');
    setError('');
    setOpen(true);
  }
  async function save(value: unknown) {
    setBusy(true);
    setError('');
    try {
      await onSave(value);
      setOpen(false);
      setDeleting(null);
      setOrder(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(name: string, target: string) {
    setOrder(current => {
      if (!current) return current;
      const next = [...current],
        from = next.findIndex(c => c.name === name),
        to = next.findIndex(c => c.name === target);
      if (from < 0 || to < 0) return current;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }
  const visible = (order || items).filter(c => (order || all || !c.archived) && c.name.includes(query));
  return (
    <Card>
      {confirmation}
      <div className={styles.categoryToolbar}>
        <h2>{tr('我的分类小伙伴')}</h2>
        {canWrite && (
          <div className={styles.inline}>
            {order ? (
              <>
                <Button disabled={busy} onClick={() => setOrder(null)}>
                  {tr('取消排序')}
                </Button>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => save({ operation: 'reorder', names: order.map(c => c.name) })}
                >
                  {tr('保存顺序')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOrder([...items]);
                    setQuery('');
                    setError('');
                  }}
                >
                  <GripVertical size={18} />
                  {tr('调整顺序')}
                </Button>
                <Button variant="ghost" onClick={() => edit(null)}>
                  {tr('＋ 添加分类')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <p className={styles.muted}>
        {tr(
          '同一家庭的成员可复用彼此创建的分类。你的排序、停用和个人设置适用于自己的所有账本，不会修改他人的设置。',
        )}
      </p>
      {error && !open && !deleting && (
        <p className={styles.error} role="alert">
          {tr(error)}
        </p>
      )}
      {!order && (
        <Input
          aria-label={tr('搜索分类')}
          placeholder={tr('搜索分类名称…')}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      )}
      <div className={styles.categoryManager}>
        {
          <PagedList items={visible} pageSize={12} resetKey={query + String(all) + String(!!order)}>
            {(c, index) => (
              <div
                className={styles.categoryCard}
                key={c.name}
                draggable={!!order && !busy}
                onDragStart={() => setDragged(c.name)}
                onDragOver={e => {
                  if (order) e.preventDefault();
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragged && !busy) move(dragged, c.name);
                  setDragged(null);
                }}
                onDragEnd={() => setDragged(null)}
              >
                <Button
                  className={styles.categoryEdit}
                  disabled={!canWrite || !!order || busy}
                  onClick={() => edit(c)}
                >
                  <SymbolIcon icon={c.icon} size={52} />
                  <strong>{c.name}</strong>
                  <small>{c.archived ? tr('已停用') : order ? tr('拖动排序') : tr('点击编辑')}</small>
                </Button>
                {canWrite && (
                  <div className={styles.categoryCardActions}>
                    {order ? (
                      <>
                        <Button
                          variant="primary"
                          type="button"
                          disabled={busy || index === 0}
                          aria-label={tr('前移 {0}', [c.name])}
                          onClick={() => move(c.name, visible[index - 1].name)}
                        >
                          <ArrowLeft size={16} />
                        </Button>
                        <Button
                          variant="primary"
                          type="button"
                          disabled={busy || index === visible.length - 1}
                          aria-label={tr('后移 {0}', [c.name])}
                          onClick={() => move(c.name, visible[index + 1].name)}
                        >
                          <ArrowRight size={16} />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        type="button"
                        aria-label={tr('删除分类 {0}', [c.name])}
                        onClick={() => {
                          setDeleting(c);
                          setError('');
                        }}
                      >
                        <Trash2 size={16} />
                        {tr('删除')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </PagedList>
        }
      </div>
      {!order && (
        <Button variant="ghost" onClick={() => setAll(v => !v)}>
          {all ? tr('隐藏停用分类') : tr('显示停用分类')}
        </Button>
      )}
      {deleting && (
        <ConfirmDialog
          open
          title={tr('删除分类')}
          busy={busy}
          confirmLabel={tr('确认删除')}
          onCancel={() => {
            if (!busy) setDeleting(null);
          }}
          onConfirm={() => save({ ...deleting, operation: 'delete' })}
        >
          <p>{tr('删除「{0}」？已有账目保留原分类，今后记账不再显示此选项。', [deleting.name])}</p>
          {error && (
            <p className={styles.error} role="alert">
              {tr(error)}
            </p>
          )}
        </ConfirmDialog>
      )}
      {open && (
        <Sheet
          open
          closeLabel={tr('关闭弹窗')}
          title={editing ? tr('修改分类') : tr('添加分类')}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              save({
                name: editing?.name || String(f.get('name')),
                newName: editing ? String(f.get('name')) : undefined,
                icon,
                archived: editing?.archived || false,
              });
            }}
          >
            <fieldset disabled={busy}>
              <label>
                {tr('分类名称')}
                <Input
                  name="name"
                  defaultValue={editing?.name}
                  maxLength={60}
                  required
                  placeholder={tr('例如：宠物、宝宝、数码')}
                />
              </label>
              <StickerPicker value={icon} onChange={setIcon} />
              {error && (
                <p className={styles.error} role="alert">
                  {tr(error)}
                </p>
              )}
              <div className={styles.sheetActions}>
                {editing && (
                  <Button
                    type="button"
                    onClick={() =>
                      editing.archived
                        ? save({ ...editing, archived: false })
                        : requestConfirmation(
                            <>
                              {tr('停用分类')} · {editing.name}
                            </>,
                            () => save({ ...editing, archived: true }),
                          )
                    }
                  >
                    {editing.archived ? tr('恢复分类') : tr('停用分类')}
                  </Button>
                )}
                <Button type="submit" variant="primary">
                  {tr('保存分类')}
                </Button>
              </div>
            </fieldset>
          </form>
        </Sheet>
      )}
    </Card>
  );
}
