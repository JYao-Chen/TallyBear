'use client';
import { FormSelect } from './FormSelect';
import { Select } from '@/ui';
import s from './DetailSortSelect.module.css';
import { useI18n } from './LanguageProvider';
import { detailSort, type DetailSort } from '@/lib/detail-sort';
export function DetailSortSelect({
  value,
  onChange,
  picker,
  valueLabel,
}: {
  value: DetailSort;
  onChange: (value: DetailSort) => void;
  picker?: boolean;
  valueLabel?: string;
}) {
  const { t } = useI18n();
  const options = (
    <>
      <option value="date_desc">{t('最新')}</option>
      <option value="date_asc">{t('最早')}</option>
      <option value="amount_desc">{valueLabel ? valueLabel + t(' · 从高到低') : t('金额高')}</option>
      <option value="amount_asc">{valueLabel ? valueLabel + t(' · 从低到高') : t('金额低')}</option>
    </>
  );
  return picker ? (
    <FormSelect aria-label={t('明细排序')} value={value} onChange={next => onChange(detailSort(next))}>
      {options}
    </FormSelect>
  ) : (
    <Select
      className={s.sort}
      aria-label={t('明细排序')}
      value={value}
      onChange={e => onChange(detailSort(e.target.value))}
    >
      {options}
    </Select>
  );
}
