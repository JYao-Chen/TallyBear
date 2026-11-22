'use client';
import { useI18n } from './LanguageProvider';
import { useEffect, useState } from 'react';
import { DateField } from './DateField';
import { Button, ChipButton, Sheet, Select, Input } from '@/ui';
import s from './ReportPeriodPicker.module.css';
import { recordingDate } from '@/lib/entry-time';
import { periodRange, type ReportPeriod, type ReportRange } from '@/lib/report-period';

export function ReportPeriodPicker({
  value,
  onChange,
}: {
  value: ReportRange;
  onChange: (range: ReportRange) => void;
}) {
  const { t: tr } = useI18n();
  const [period, setPeriod] = useState<ReportPeriod>(() => {
    const month = periodRange('month', value.from);
    return month.from === value.from && month.to === value.to ? 'month' : 'custom';
  });
  const [from, setFrom] = useState(value.from),
    [to, setTo] = useState(value.to);
  useEffect(() => {
    setFrom(value.from);
    setTo(value.to);
  }, [value.from, value.to]);
  const [custom, setCustom] = useState(false);
  const current = periodRange('month', recordingDate());
  const start = new Date(current.from + 'T00:00:00Z');
  function monthsAgo(n: number) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 10);
  }
  const shortcuts = [
    { label: '本月', range: current },
    { label: '上月', range: periodRange('month', monthsAgo(1)) },
    { label: '近 3 月', range: { from: monthsAgo(2), to: current.to } },
  ];
  const matches = (r: ReportRange) => r.from === value.from && r.to === value.to;
  const invalid = !from || !to || from > to;
  return (
    <section className={s.picker} aria-label={tr('统计周期')}>
      {shortcuts.map(({ label, range }) => (
        <ChipButton key={label} selected={matches(range)} onClick={() => onChange(range)}>
          {tr(label)}
        </ChipButton>
      ))}
      <ChipButton
        selected={!shortcuts.some(({ range }) => matches(range))}
        onClick={() => {
          setFrom(value.from);
          setTo(value.to);
          setPeriod('custom');
          setCustom(true);
        }}
      >
        {tr('自定义')}
      </ChipButton>
      <Sheet
        open={custom}
        onClose={() => setCustom(false)}
        title={tr('自定义日期')}
        closeLabel={tr('关闭弹窗')}
      >
        <div className={s.dates}>
          <label>
            {tr('统计周期')}
            <Select
              value={period}
              onChange={e => {
                const p = e.target.value as ReportPeriod;
                setPeriod(p);
                if (p !== 'custom') onChange(periodRange(p, value.from));
              }}
            >
              <option value="year">{tr('按年')}</option>
              <option value="month">{tr('按月')}</option>
              <option value="week">{tr('按周')}</option>
              <option value="day">{tr('指定日')}</option>
              <option value="custom">{tr('自定义日期')}</option>
            </Select>
          </label>
          {period === 'custom' ? (
            <>
              <label>
                {tr('开始日期')}
                <DateField required type="date" value={from} onChange={setFrom} />
              </label>
              <label>
                {tr('结束日期')}
                <DateField required type="date" value={to} onChange={setTo} />
              </label>
              <Button
                variant="primary"
                disabled={invalid}
                onClick={() => {
                  onChange({ from, to });
                  setCustom(false);
                }}
              >
                {tr('应用日期')}
              </Button>
              {invalid && <small role="alert">{tr('结束日期不能早于开始日期')}</small>}
            </>
          ) : period === 'year' ? (
            <label>
              {tr('统计年份')}
              <Input
                key={value.from}
                type="number"
                min="1000"
                max="9999"
                defaultValue={value.from.slice(0, 4)}
                onBlur={e => {
                  const year = e.currentTarget.value;
                  if (/^[1-9]\d{3}$/.test(year)) onChange(periodRange('year', year + '-01-01'));
                  else e.currentTarget.value = value.from.slice(0, 4);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </label>
          ) : (
            <label>
              {period === 'week'
                ? tr('选择周内任一天')
                : period === 'month'
                  ? tr('选择月份')
                  : tr('交易日期')}
              <DateField
                required
                type={period === 'month' ? 'month' : 'date'}
                value={period === 'month' ? value.from.slice(0, 7) : value.from}
                onChange={v => onChange(periodRange(period, period === 'month' ? v + '-01' : v))}
              />
            </label>
          )}
          <small className={s.summary}>
            {value.from} — {value.to} {tr(' · 包含起止日')}
            {period === 'week' ? tr(' · 周一至周日') : ''}
          </small>
        </div>
      </Sheet>
    </section>
  );
}
