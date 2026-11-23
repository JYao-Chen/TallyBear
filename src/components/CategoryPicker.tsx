'use client';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Input, Sheet } from '@/ui';
import { useI18n } from './LanguageProvider';
import { SymbolIcon } from './VisualSelect';
import styles from './CategoryPicker.module.css';

type Option = { value: string; label: string; icon?: string };

/**
 * Category choice for an entry: the most used categories stay one tap away,
 * the full list opens in a searchable sheet instead of growing the form.
 */
export function CategoryPicker({
  options,
  value,
  onChange,
  label,
  quick = 7,
  disabled,
}: {
  /** Sorted by how often they are used. */
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  quick?: number;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState('');
  const shortlist = useMemo(() => {
    const top = options.slice(0, quick);
    const chosen = options.find(o => o.value === value);
    return chosen && !top.includes(chosen) ? [chosen, ...top.slice(0, quick - 1)] : top;
  }, [options, quick, value]);
  const query = q.trim().toLowerCase();
  const matches = query
    ? options.filter(o => [o.value, o.label, t(o.label)].some(s => s.toLowerCase().includes(query)))
    : options;
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQ('');
  };
  const item = (o: Option, size: number) => (
    <>
      <SymbolIcon icon={o.icon || '🧸'} size={size} still />
      <span>{t(o.label)}</span>
    </>
  );
  return (
    <div className={styles.picker} role="group" aria-label={label}>
      {shortlist.map(o => (
        <button
          type="button"
          key={o.value}
          className={styles.quick}
          aria-pressed={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {item(o, 22)}
        </button>
      ))}
      {options.length > shortlist.length && (
        <button
          type="button"
          className={`${styles.quick} ${styles.all}`}
          disabled={disabled}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Search size={16} aria-hidden="true" />
          <span>{t('全部 {0} 类', [options.length])}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
      {open && (
        <Sheet open title={label} closeLabel={t('关闭弹窗')} onClose={() => setOpen(false)}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <Input
              autoFocus
              value={q}
              aria-label={t('搜索分类')}
              placeholder={t('搜索分类')}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && matches.length) {
                  e.preventDefault();
                  choose(matches[0].value);
                }
              }}
            />
          </label>
          {matches.length ? (
            <div className={styles.grid}>
              {matches.map(o => (
                <button
                  type="button"
                  key={o.value}
                  className={styles.cell}
                  aria-pressed={o.value === value}
                  onClick={() => choose(o.value)}
                >
                  {item(o, 36)}
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>{t('没有找到这个分类，可以在“账本设置 · 分类”里新建。')}</p>
          )}
        </Sheet>
      )}
    </div>
  );
}
