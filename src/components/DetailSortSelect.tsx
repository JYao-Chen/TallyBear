'use client';
import { Select } from '@/ui';
import s from './DetailSortSelect.module.css';
import { useI18n } from './LanguageProvider';
import { detailSort, type DetailSort } from '@/lib/detail-sort';
export function DetailSortSelect({
  value,
  onChange,
  valueLabel,
}: {
  value: DetailSort;
  onChange: (value: DetailSort) => void;
  valueLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <Select
      className={s.sort}
      aria-label={t('明细排序')}
      value={value}
      onChange={e => onChange(detailSort(e.target.value))}
    >
      <option value="date_desc">{t('时间 · 从新到旧')}</option>
      <option value="date_asc">{t('时间 · 从旧到新')}</option>
      <option value="amount_desc">
        {valueLabel || t('金额')}
        {t(' · 从高到低')}
      </option>
      <option value="amount_asc">
        {valueLabel || t('金额')}
        {t(' · 从低到高')}
      </option>
    </Select>
  );
}
