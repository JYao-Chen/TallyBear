'use client';
import styles from './DateField.module.css';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from './LanguageProvider';
import { Sheet } from '@/ui/Sheet';
import { calendarDays, validCalendarValue } from '@/lib/calendar';
type Props = {
  type: 'date' | 'month';
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  onChange?: (value: string) => void;
};
export function DateField({
  type,
  value,
  defaultValue = '',
  name,
  required,
  disabled,
  'aria-label': ariaLabel,
  onChange,
}: Props) {
  const { locale, t: tr } = useI18n(),
    en = locale === 'en';
  const [local, setLocal] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [label, setLabel] = useState(ariaLabel || ''),
    [manual, setManual] = useState(''),
    [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const selected = value ?? local;
  const now = new Date(),
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [year, setYear] = useState(now.getFullYear()),
    [month, setMonth] = useState(now.getMonth());
  useEffect(() => {
    const el = input.current!;
    if (!ariaLabel) {
      const text = Array.from(el.closest('label')?.childNodes || [])
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent)
        .join('')
        .trim();
      setLabel(text);
    }
    const form = el.form,
      reset = () => {
        setLocal(defaultValue);
        setOpen(false);
      };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [ariaLabel, defaultValue]);
  function show() {
    const start = validCalendarValue(selected, type) ? selected : today;
    setYear(Number(start.slice(0, 4)));
    setMonth(Number(start.slice(5, 7)) - 1);
    setManual(selected);
    setError('');
    setOpen(true);
  }
  function choose(next: string) {
    if (next && !validCalendarValue(next, type)) {
      setError(tr('请输入有效日期。'));
      return;
    }
    if (!next && required) return;
    setLocal(next);
    onChange?.(next);
    setOpen(false);
  }
  function move(direction: number) {
    const total = year * 12 + month + direction,
      y = Math.floor(total / 12);
    if (y >= 1 && y <= 9999) {
      setYear(y);
      setMonth(((total % 12) + 12) % 12);
    }
  }
  const title = label || (type === 'month' ? tr('选择月份') : tr('选择日期'));
  const shown = validCalendarValue(selected, type)
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        ...(type === 'date' ? { day: 'numeric' as const } : {}),
        timeZone: 'UTC',
      }).format(new Date(selected + (type === 'month' ? '-01T12:00:00Z' : 'T12:00:00Z')))
    : tr('请选择');
  const display =
    validCalendarValue(selected, type) && type === 'date'
      ? en
        ? new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC',
          }).format(new Date(selected + 'T12:00:00Z'))
        : selected.replaceAll('-', '/')
      : shown;
  return (
    <div className={styles.field}>
      <input
        hidden
        ref={input}
        type={type}
        name={name}
        value={selected}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => choose(e.target.value)}
        onInvalid={e => {
          e.preventDefault();
          trigger.current?.focus();
          show();
        }}
      />
      <button
        type="button"
        ref={trigger}
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${title}: ${shown}`}
        onClick={show}
      >
        <CalendarDays size={18} />
        <span title={shown}>{display}</span>
      </button>
      {open && (
        <Sheet open title={title} onClose={() => setOpen(false)}>
          <div className={styles.picker}>
            <div className={styles.nav}>
              <button
                className={styles.icon}
                type="button"
                aria-label={tr('上一页')}
                onClick={() => (type === 'month' ? setYear(y => Math.max(1, y - 1)) : move(-1))}
              >
                <ChevronLeft size={18} />
              </button>
              <label className={styles.year}>
                <span>{tr('年份')}</span>
                <input
                  aria-label={tr('年份')}
                  type="number"
                  min={1}
                  max={9999}
                  value={year}
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (n >= 1 && n <= 9999) setYear(n);
                  }}
                />
              </label>
              {type === 'date' && (
                <strong>
                  {new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month, 1))}
                </strong>
              )}
              <button
                className={styles.icon}
                type="button"
                aria-label={tr('下一页')}
                onClick={() => (type === 'month' ? setYear(y => Math.min(9999, y + 1)) : move(1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            {type === 'month' ? (
              <div className={styles.months}>
                {Array.from({ length: 12 }, (_, m) => {
                  const v = `${String(year).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
                  return (
                    <button type="button" key={m} aria-pressed={selected === v} onClick={() => choose(v)}>
                      {new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, m, 1))}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className={styles.week} aria-hidden="true">
                  {(en
                    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
                    : ['一', '二', '三', '四', '五', '六', '日']
                  ).map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div
                  className={styles.days}
                  onKeyDown={e => {
                    const delta = (
                      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>
                    )[e.key];
                    if (!delta) return;
                    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
                    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    if (i >= 0 && buttons[i + delta]) {
                      e.preventDefault();
                      buttons[i + delta].focus();
                    }
                  }}
                >
                  {calendarDays(year, month).map(d => (
                    <button
                      type="button"
                      key={d.value}
                      className={d.current ? undefined : styles.adjacent}
                      disabled={!validCalendarValue(d.value, 'date')}
                      aria-label={d.value}
                      aria-pressed={d.value === selected}
                      autoFocus={d.value === (selected || today)}
                      aria-current={d.value === today ? 'date' : undefined}
                      onClick={() => choose(d.value)}
                    >
                      {d.day}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className={styles.manual}>
              <input
                type="text"
                aria-label={tr('手动输入日期')}
                placeholder={type === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}
                value={manual}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    choose(manual);
                  }
                }}
              />
              <button type="button" onClick={() => choose(manual)} disabled={!manual && required}>
                {tr('确定')}
              </button>
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <button
                className={styles.link}
                type="button"
                onClick={() => choose(type === 'month' ? today.slice(0, 7) : today)}
              >
                {type === 'month' ? tr('本月') : tr('今天')}
              </button>
              {!required && (
                <button className={styles.link} type="button" onClick={() => choose('')}>
                  {tr('清空')}
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
