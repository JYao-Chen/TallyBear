'use client';
import { Segmented, Button, Card, Field, Input, TextArea, Sheet, Money, ListRow } from '@/ui';
import styles from './TemplatesPanel.module.css';
import shared from './WorkspacePlans.module.css';
import { PagedList } from './PagedList';

import { SceneFields } from './SceneFields';
import { emptyScene } from '@/lib/entry-scene';
import { useI18n } from './LanguageProvider';
import { accountLabel, type AccountIdentity } from '@/lib/accounts';
import { VisualSelect, CategoryIcons, CategoryIcon } from './VisualSelect';
import { useContext, useState } from 'react';
import { Plus, Pencil, ChevronDown, ChevronUp, Check, BookmarkPlus } from 'lucide-react';
import { amountToCents } from '@/server/model';
import { LineItemsEditor } from './LineItems';
import type { Draft } from './DraftReview';
export type Template = { id: string; name: string; value: Draft; version: number };
type Props = {
  items: Template[];
  current: Partial<Draft>;
  accounts: (AccountIdentity & { id: string })[];
  onSave: (body: unknown, method: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUse: (value: Draft) => Promise<void>;
};
export function TemplatesPanel({ items, current, accounts, onSave, onDelete, onUse }: Props) {
  const { t: tr } = useI18n();
  const [editor, setEditor] = useState<{ selected: Template | null; seed: Partial<Draft> } | null>(null),
    [collapsed, setCollapsed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const applied =
    items.find(t => current.amount === t.value.amount && current.title && current.title === t.value.title)
      ?.name || '';
  async function use(value: Draft) {
    setBusy(true);
    setError('');
    try {
      await onUse(value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={shared.panel + ' ' + styles.templatePanel} aria-label={tr('常用一笔')}>
      <div className={styles.templateHeading}>
        <Button
          variant="secondary"
          type="button"
          className={styles.templateToggle}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <BookmarkPlus size={18} />
          <strong>{tr('常用一笔')}</strong>
          <span className={styles.templateCount}>{items.length}</span>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </Button>
        <Button
          variant="secondary"
          type="button"
          className={styles.templateAdd}
          disabled={busy}
          onClick={() => {
            setError('');
            setEditor({ selected: null, seed: {} });
          }}
        >
          <Plus size={17} />
          {tr('新增预设')}
        </Button>
      </div>
      {error && (
        <p className={shared.error} role="alert">
          {tr(error)}
        </p>
      )}
      {!collapsed && (
        <div className={styles.templateCards}>
          {
            <PagedList items={items}>
              {t => (
                <div className={applied === t.name ? styles.applied : styles.presetCard} key={t.id}>
                  <ListRow
                    disabled={busy}
                    aria-label={tr('使用预设') + ' ' + t.name}
                    onClick={() => use(t.value)}
                    leading={<CategoryIcon name={t.value.category} />}
                    title={t.name}
                    meta={
                      t.value.scene?.origin && t.value.scene?.destination
                        ? t.value.scene.origin + ' → ' + t.value.scene.destination
                        : t.value.category
                    }
                    end={<Money value={t.value.amount} />}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    className={styles.presetEdit}
                    disabled={busy}
                    aria-label={tr('编辑预设') + ' ' + t.name}
                    onClick={() => setEditor({ selected: t, seed: t.value })}
                  >
                    <Pencil size={15} />
                  </Button>
                </div>
              )}
            </PagedList>
          }
          {!items.length && (
            <Button
              variant="secondary"
              className={styles.presetEmpty}
              type="button"
              onClick={() => setEditor({ selected: null, seed: {} })}
            >
              <Plus size={20} />
              {tr('添加通勤、早餐或工资预设')}
            </Button>
          )}
        </div>
      )}
      {applied && (
        <div className={styles.presetFeedback} role="status">
          <Check size={15} />
          {tr('已填入')}
          {' ' + applied}
        </div>
      )}
      {!!current.amount && current.kind !== 'refund' && (
        <Button
          variant="secondary"
          type="button"
          className={styles.templateSaveCurrent}
          disabled={busy}
          onClick={() => setEditor({ selected: null, seed: current })}
        >
          <BookmarkPlus size={15} />
          {tr('把当前内容存为常用')}
        </Button>
      )}
      {editor && (
        <TemplateEditor
          selected={editor.selected}
          seed={editor.seed}
          accounts={accounts}
          onClose={() => setEditor(null)}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Card>
  );
}
function TemplateEditor({
  selected,
  seed,
  accounts,
  onClose,
  onSave,
  onDelete,
}: {
  selected: Template | null;
  seed: Partial<Draft>;
  accounts: Props['accounts'];
  onClose: () => void;
  onSave: Props['onSave'];
  onDelete: Props['onDelete'];
}) {
  const { t: tr } = useI18n(),
    categories = useContext(CategoryIcons);
  const [scene, setScene] = useState(seed.scene || emptyScene());
  const [name, setName] = useState(selected?.name || seed.title || seed.payee || ''),
    [kind, setKind] = useState<Draft['kind']>(seed.kind === 'refund' ? 'expense' : seed.kind || 'expense'),
    [amount, setAmount] = useState(seed.amount ? String(seed.amount / 100) : ''),
    [account, setAccount] = useState(seed.accountId || accounts[0]?.id || ''),
    [target, setTarget] = useState(seed.targetId || ''),
    [category, setCategory] = useState(
      seed.category || categories.find(c => c.name === '交通')?.name || categories[0]?.name || tr('其他'),
    ),
    [title, setTitle] = useState(seed.title || ''),
    [payee, setPayee] = useState(seed.payee || ''),
    [note, setNote] = useState(seed.note || ''),
    [lineItems, setLineItems] = useState(seed.lineItems || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (!accounts.some(a => a.id === account)) throw new Error('请选择可用的资金账户');
      const cents = amountToCents(amount);
      if (!cents) throw new Error('请输入大于0的金额');
      if (kind === 'transfer' && (!target || target === account)) throw new Error('转账需要不同的转入账户');
      const value = {
        ...seed,
        scene,
        id: cryptoId(),
        date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
        title: title.trim() || name.trim(),
        kind,
        amount: cents,
        accountId: account,
        targetId: kind === 'transfer' ? target : null,
        category,
        payee,
        note,
        lineItems: kind === 'transfer' ? [] : lineItems,
        refundOf: null,
      };
      await onSave(
        { id: selected?.id, version: selected?.version, name: name.trim(), value },
        selected ? 'PUT' : 'POST',
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      closeLabel={tr('关闭弹窗')}
      title={tr(selected ? '修改常用记录' : '新增记账预设')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className={styles.presetEditor} onSubmit={save}>
        <fieldset disabled={busy}>
          <Field label={tr('预设名称')}>
            {control => (
              <Input
                {...control}
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tr('例如：上班地铁、下班地铁、每月工资')}
              />
            )}
          </Field>
          <Segmented
            className={shared.tabs}
            label={tr('类型')}
            value={kind}
            onChange={v => setKind(v as Draft['kind'])}
            options={[
              ['expense', '支出'],
              ['income', '收入'],
              ['transfer', '转账'],
            ].map(([value, label]) => ({ value, label: tr(label) }))}
          />
          <div className={shared.grid}>
            <Field label={tr('金额（元）')}>
              {control => (
                <Input
                  {...control}
                  required
                  className={shared.numeric}
                  inputMode="decimal"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              )}
            </Field>
            <label>
              {tr('分类')}
              <VisualSelect
                label={tr('预设分类')}
                value={category}
                onChange={setCategory}
                options={[...new Set([category, ...categories.map(c => c.name)])].map(name => ({
                  value: name,
                  label: name,
                }))}
              />
            </label>
            <label>
              {tr('资金账户')}
              <VisualSelect
                label={tr('预设资金账户')}
                value={account}
                onChange={setAccount}
                options={accounts.map(a => ({
                  value: a.id,
                  label: accountLabel(a),
                  account: true,
                  accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                }))}
              />
            </label>
            {kind === 'transfer' && (
              <label>
                {tr('转入账户')}
                <VisualSelect
                  label={tr('转入账户')}
                  value={target}
                  onChange={setTarget}
                  options={accounts
                    .filter(a => a.id !== account)
                    .map(a => ({
                      value: a.id,
                      label: accountLabel(a),
                      account: true,
                      accountName: [a.institution, a.name, a.type].filter(Boolean).join(' '),
                    }))}
                />
              </label>
            )}
          </div>
          {!accounts.length && (
            <p className={shared.notice}>{tr('请先在资金资产中添加一个钱包，再保存预设。')}</p>
          )}
          <SceneFields
            value={scene}
            onChange={(value, title) => {
              setScene(value);
              if (title) setTitle(title);
            }}
          />
          <details className={styles.presetNotes}>
            <summary>{tr('标题与备注')}</summary>
            <Field label={tr('账目标题')}>
              {control => (
                <Input
                  {...control}
                  maxLength={80}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={name || tr('例如：上班地铁')}
                />
              )}
            </Field>
            <Field label={tr('商家 / 交易对方')}>
              {control => (
                <Input {...control} maxLength={120} value={payee} onChange={e => setPayee(e.target.value)} />
              )}
            </Field>
            <Field label={tr('路线或备注')}>
              {control => (
                <TextArea
                  {...control}
                  rows={2}
                  maxLength={2000}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={tr('例如：家附近站 → 公司站，单程4元')}
                />
              )}
            </Field>
          </details>
          {!!lineItems.length && kind !== 'transfer' && (
            <LineItemsEditor
              items={lineItems}
              onChange={setLineItems}
              total={Math.round(Number(amount) * 100)}
              onTotal={n => setAmount(String(n / 100))}
            />
          )}

          {error && (
            <p className={shared.error} role="alert">
              {tr(error)}
            </p>
          )}
          <div className={shared.actions}>
            {selected && (
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await onDelete(selected.id);
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {tr('删除常用')}
              </Button>
            )}
            <Button variant="primary" type="submit" disabled={busy || !accounts.length}>
              {tr(busy ? '正在保存…' : '保存预设')}
            </Button>
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}
function cryptoId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, n => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
