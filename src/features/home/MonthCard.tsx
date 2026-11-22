'use client';
import Link from 'next/link';
import { useI18n } from '@/components/LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { pathForPage } from '@/lib/routes';
import { Bear, Card } from '@/ui';
import s from './home.module.css';

type Props = {
  month: string;
  /** Cents, allocation basis (按归属期). */
  income: number;
  netExpense: number;
  budget?: { amount: number; spent: number };
};

export function MonthCard({ month, income, netExpense, budget }: Props) {
  const { t, locale, currency } = useI18n();
  const money = (v: number) => formatMoney(v, { language: locale, currency });
  const ratio = budget && budget.amount > 0 ? budget.spent / budget.amount : 0;
  return (
    <Card tone="accent" className={s.month} aria-label={t('本月概况')}>
      <div className={s.monthHead}>
        <strong>{t('{0} 年 {1} 月', month.split('-').map(Number))}</strong>
        <small>{t('按归属期')}</small>
      </div>
      <div className={s.monthMain}>
        <span>{t('净支出')}</span>
        <strong>{money(netExpense)}</strong>
      </div>
      <div className={s.pairs}>
        <div>
          <span className={s.or} style={{ color: 'inherit', opacity: 0.8 }}>
            {t('收入')}
          </span>
          <br />
          <strong>{money(income)}</strong>
        </div>
        <div>
          <span className={s.or} style={{ color: 'inherit', opacity: 0.8 }}>
            {t('结余')}
          </span>
          <br />
          <strong>{money(income - netExpense)}</strong>
        </div>
      </div>
      {budget && budget.amount > 0 ? (
        <div className={s.budget}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {t('预算')} {money(budget.spent)} / {money(budget.amount)}
            </span>
            {ratio < 0.8 && <Bear pose="cheer" size={28} />}
          </div>
          <div className={`${s.bar} ${ratio > 1 ? s.over : ''}`} role="presentation">
            <span style={{ width: Math.min(100, ratio * 100) + '%' }} />
          </div>
        </div>
      ) : (
        <Link className={s.monthLink} href={pathForPage('budget')}>
          {t('设置本月预算 →')}
        </Link>
      )}
    </Card>
  );
}
