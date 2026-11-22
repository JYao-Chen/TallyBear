'use client';
import { useI18n } from './LanguageProvider';
import { DateField } from './DateField';
import type { EntryInstallment } from '@/lib/entry-installment';
export function EntryInstallmentFields({
  value,
  onChange,
  credit,
}: {
  value?: EntryInstallment | null;
  onChange: (v: EntryInstallment | null) => void;
  credit: boolean;
}) {
  const { locale } = useI18n(),
    l = (zh: string, en: string) => (locale === 'en' ? en : zh);
  return (
    <section className="entry-optional">
      <label className="check">
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked ? { firstDate: '', fees: 0 } : null)}
        />
        {l('这笔支出分期还款', 'Pay this purchase in installments')}
      </label>
      {value && (
        <>
          {!credit && (
            <p className="notice">
              {l(
                '请选择信用卡、白条或花呗作为实际付款账户。',
                'Select a credit card or BNPL payment account.',
              )}
            </p>
          )}
          <div className="form-grid">
            <label>
              {l('分期期数', 'Installments')}
              <input
                type="number"
                min={1}
                max={600}
                required
                value={value.terms ?? ''}
                onChange={e =>
                  onChange({ ...value, terms: e.target.value ? Number(e.target.value) : undefined })
                }
              />
            </label>
            <label>
              {l('首次还款日期', 'First repayment date')}
              <DateField
                type="date"
                required
                value={value.firstDate}
                onChange={firstDate => onChange({ ...value, firstDate })}
              />
            </label>
            <label>
              {l('总手续费（元）', 'Total fees')}
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={value.fees == null ? '' : value.fees / 100}
                onChange={e =>
                  onChange({
                    ...value,
                    fees: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
          </div>
          <p className="muted">
            {l(
              '保存支出时一并建立还款排期，不重复消费、不立即扣款。费用分摊仍单独设置；已有分期请在原计划中调整。',
              'Saving creates a repayment schedule without another purchase or immediate payment. Cost allocation is separate. Update existing installments in their original plan.',
            )}
          </p>
        </>
      )}
    </section>
  );
}
