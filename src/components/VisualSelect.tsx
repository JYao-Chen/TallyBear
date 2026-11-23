'use client';
import { useI18n } from './LanguageProvider';
import styles from './VisualSelect.module.css';
import { Button } from '@/ui/Button';
import { ChoicePicker } from './ChoicePicker';
import { useTheme } from './ThemeProvider';
import { useState, createContext, useContext } from 'react';
import {
  ChevronDown,
  Check,
  Wallet,
  Landmark,
  Banknote,
  UserRound,
  Tag,
  CreditCard,
  ChartNoAxesCombined,
} from 'lucide-react';
import { bankLogo } from '@/lib/banks';
import stickers from '@/lib/stickers.json';
export const CategoryIcons = createContext<{ name: string; icon: string }[]>([]);
export function CategoryIcon({ name, size = 36 }: { name: string; size?: number }) {
  const { t: tr, locale } = useI18n();
  const items = useContext(CategoryIcons);
  return <SymbolIcon icon={items.find(c => c.name === name)?.icon || '🧸'} size={size} />;
}
export function SymbolIcon({
  icon,
  size = 40,
  fallback = 'tag',
  still = false,
}: {
  icon: string;
  size?: number;
  fallback?: 'user' | 'tag';
  /** Use the static image of a sticker (lists with many icons). */
  still?: boolean;
}) {
  const { t: tr, locale } = useI18n();
  const { theme } = useTheme();
  if (theme === 'minimal' && icon.startsWith('sticker:')) {
    const Icon = fallback === 'user' ? UserRound : Tag;
    return (
      <span className={styles.symbol} style={{ width: size, height: size }}>
        <Icon size={size * 0.62} />
      </span>
    );
  }
  if (icon.startsWith('data:image/'))
    return (
      <span className={styles.symbol} style={{ width: size, height: size }}>
        <img src={icon} width={size} height={size} alt="" />
      </span>
    );
  const id = icon.startsWith('sticker:') ? icon.slice(8) : '';
  if (id && stickers.includes(id) && still)
    return (
      <span className={styles.symbol} style={{ width: size, height: size }}>
        <img
          loading="lazy"
          decoding="async"
          src={`/stickers/bubu-yier-${id}.png`}
          width={size}
          height={size}
          alt=""
        />
      </span>
    );
  return id && stickers.includes(id) ? (
    <picture className={styles.symbol} style={{ width: size, height: size }}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/stickers/bubu-yier-${id}.png`} />
      <img
        loading="lazy"
        decoding="async"
        src={`/stickers/bubu-yier-${id}.gif`}
        width={size}
        height={size}
        alt=""
      />
    </picture>
  ) : (
    <span className={styles.symbol} style={{ width: size, height: size, fontSize: size * 0.65 }}>
      {icon}
    </span>
  );
}
export function AccountIcon({ name, size = 28 }: { name: string; size?: number }) {
  const { t: tr, locale } = useI18n();
  const bank = bankLogo(name);
  const brand = bank
    ? 'banks/' + bank
    : /微信|wechat|weixin/i.test(name)
      ? 'wechat'
      : /支付宝|alipay/i.test(name)
        ? 'alipay'
        : null;
  return brand ? (
    <img className={styles.logo} src={`/brands/${brand}.svg`} width={size} height={size} alt="" />
  ) : /信用卡|白条|花呗|credit/i.test(name) ? (
    <CreditCard size={size} />
  ) : /银行|储蓄|bank/i.test(name) ? (
    <Landmark size={size} />
  ) : /投资|理财|investment/i.test(name) ? (
    <ChartNoAxesCombined size={size} />
  ) : /现金|cash/i.test(name) ? (
    <Banknote size={size} />
  ) : (
    <Wallet size={size} />
  );
}
type Option = { value: string; label: string; icon?: string; account?: boolean; accountName?: string };
export function VisualSelect({
  options,
  value,
  defaultValue,
  name,
  onChange,
  disabled = false,
  label = '请选择',
  grid = false,
}: {
  grid?: boolean;
  options: Option[];
  value?: string;
  defaultValue?: string;
  name?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const { t: tr, locale } = useI18n();
  const [local, setLocal] = useState(defaultValue ?? options[0]?.value ?? ''),
    [open, setOpen] = useState(false);
  const categories = useContext(CategoryIcons),
    selected = value ?? local,
    chosen = options.find(o => o.value === selected);
  const icon = (o: Option) =>
    o.account ? (
      <AccountIcon name={o.accountName || o.label} />
    ) : o.icon ? (
      <SymbolIcon icon={o.icon} size={30} />
    ) : categories.some(c => c.name === o.label) ? (
      <CategoryIcon name={o.label} size={30} />
    ) : undefined;
  if (grid) {
    const visible = open ? options : options.filter((o, i) => i < 5 || o.value === selected);
    return (
      <div className={styles.categories} role="group" aria-label={tr(label)}>
        {visible.map(o => (
          <Button
            key={o.value}
            aria-label={tr(o.label)}
            disabled={disabled}
            aria-pressed={selected === o.value}
            onClick={() => {
              setLocal(o.value);
              onChange?.(o.value);
            }}
          >
            {o.icon ? <SymbolIcon icon={o.icon} size={26} still /> : icon(o)}
            {tr(o.label)}
          </Button>
        ))}
        {options.length > 5 && (
          <Button aria-expanded={open} onClick={() => setOpen(!open)}>
            {tr(open ? '收起更多分类' : '全部分类')}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className={styles.select}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        className={styles.trigger}
        aria-label={tr(label) + '：' + (chosen?.label || tr('未选择'))}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {chosen && icon(chosen)}
        <span title={chosen?.label}>{chosen?.label || tr(label)}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <ChoicePicker
          title={tr(label)}
          options={options.map(o => ({ ...o, icon: icon(o) }))}
          value={selected}
          onSelect={v => {
            setLocal(v);
            onChange?.(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
export function StickerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t: tr, locale } = useI18n();
  const { theme } = useTheme();
  const [page, setPage] = useState(0),
    [q, setQ] = useState('');
  const ids = stickers.filter(id => id.includes(q)),
    pages = Math.ceil(ids.length / 24);
  if (theme === 'minimal')
    return (
      <div className={styles.icons}>
        {'🍜 🥬 ☕ 🛍️ 🚇 🏡 🎮 💊 📚 🔑 💡 🧳 💼 🎁 🍼 💻 🎨 💐 📒 👤'.split(' ').map(icon => (
          <button type="button" key={icon} aria-pressed={value === icon} onClick={() => onChange(icon)}>
            {icon}
          </button>
        ))}
      </div>
    );
  return (
    <div className={styles.library}>
      <div className={styles.current}>
        <SymbolIcon icon={value} size={64} />
        <div>
          <strong>{tr('为分类选一只小熊')}</strong>
          <small>
            {tr('全部')}
            {stickers.length} {tr('张 · 点击选择')}
          </small>
        </div>
      </div>
      <input
        placeholder={tr('按表情编号查找，例如 025')}
        aria-label={tr('搜索表情编号')}
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setPage(0);
        }}
      />
      <div className={styles.icons}>
        {ids.slice(page * 24, page * 24 + 24).map(id => (
          <button
            type="button"
            key={id}
            aria-label={tr('选择表情 {0}', [id])}
            aria-pressed={value === 'sticker:' + id}
            onClick={() => onChange('sticker:' + id)}
          >
            <SymbolIcon icon={'sticker:' + id} size={58} />
            <small>{id}</small>
          </button>
        ))}
      </div>
      <div className={styles.pages}>
        <button
          type="button"
          className={styles.secondary}
          disabled={!page}
          onClick={() => setPage(p => p - 1)}
        >
          {tr('上一组')}
        </button>
        <small>
          {pages ? page + 1 : 0} / {pages}
        </small>
        <button
          type="button"
          className={styles.secondary}
          disabled={page + 1 >= pages}
          onClick={() => setPage(p => p + 1)}
        >
          {tr('下一组')}
        </button>
      </div>
      <details>
        <summary>{tr('也可以使用简洁符号')}</summary>
        <div className={styles.icons}>
          {'🧸 🍜 🥬 ☕ 🛍️ 🚇 🏡 🎮 💊 📚 🔑 💡 🧳 💼 🎁 🐾 🍼 💻 🎨 💐'.split(' ').map(icon => (
            <button type="button" key={icon} onClick={() => onChange(icon)}>
              {icon}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

export function CategoryFilterSelect({
  options,
  values,
  onChange,
}: {
  options: { name: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { locale, t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  const title = tr('记账分类'),
    all = tr('全部分类');
  const label = values.length ? values.join('、') : all;
  return (
    <div className={styles.select}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={title + '：' + label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {values.length === 1 && <CategoryIcon name={values[0]} size={30} />}
        <span title={label}>{label}</span>
        <ChevronDown size={18} />
      </button>
      {open && (
        <ChoicePicker
          title={title}
          options={[
            { value: '', label: all },
            ...options.map(o => ({
              value: o.name,
              label: o.name,
              icon: <CategoryIcon name={o.name} size={30} />,
            })),
          ]}
          values={values.length ? values : ['']}
          onSelect={v =>
            onChange(!v ? [] : values.includes(v) ? values.filter(n => n !== v) : [...values, v])
          }
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
