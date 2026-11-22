import type { ReactNode } from 'react';
import s from './ui.module.css';

/** Label above a value; used in month cards and summary rows. */
export function Stat({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={[s.stat, className].filter(Boolean).join(' ')}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{children}</span>
    </div>
  );
}
