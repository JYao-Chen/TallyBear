'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import s from './ui.module.css';

export type ChipTone = 'neutral' | 'accent' | 'attention' | 'expense' | 'income';
const tones: Record<ChipTone, string | undefined> = {
  neutral: undefined,
  accent: s.chipAccent,
  attention: s.chipAttention,
  expense: s.chipExpense,
  income: s.chipIncome,
};

export function Chip({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={[s.chip, tones[tone], className].filter(Boolean).join(' ')}>{children}</span>;
}

/** Toggle chip for filters; `selected` maps to aria-pressed. */
export function ChipButton({
  selected,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={[s.chip, className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}

/** Marks a field the assistant filled in ("小熊填"). */
export function FilledBadge({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <span className={s.filled}>{children ?? t('小熊填')}</span>;
}
