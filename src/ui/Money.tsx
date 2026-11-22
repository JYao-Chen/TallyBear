'use client';
import { formatMoney } from '@/lib/deployment';
import { useI18n } from '@/components/LanguageProvider';
import s from './ui.module.css';

type Props = {
  /** Integer minor units (cents). */
  value: number;
  /** expense/income colour the amount and add a sign; plain shows it as is. */
  tone?: 'plain' | 'expense' | 'income' | 'signed';
  size?: 'md' | 'large';
  className?: string;
};

export function Money({ value, tone = 'plain', size = 'md', className }: Props) {
  const { locale, currency } = useI18n();
  const config = { language: locale, currency } as const;
  const effective = tone === 'signed' ? (value < 0 ? 'expense' : value > 0 ? 'income' : 'plain') : tone;
  const abs = Math.abs(value);
  const sign = effective === 'expense' ? '−' : effective === 'income' ? '+' : value < 0 ? '−' : '';
  const cls = [
    s.money,
    effective === 'expense' && s.moneyExpense,
    effective === 'income' && s.moneyIncome,
    size === 'large' && s.moneyLarge,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls}>
      {sign}
      {formatMoney(abs, config)}
    </span>
  );
}
