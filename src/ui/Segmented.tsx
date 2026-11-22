import type { ReactNode } from 'react';
import s from './ui.module.css';

type Option<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

/** Small set of mutually exclusive choices (entry kind, range, basis). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={[s.segmented, className].filter(Boolean).join(' ')}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          className={s.segment}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
