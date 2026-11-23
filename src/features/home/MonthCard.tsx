'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { formatMoney } from '@/lib/deployment';
import { monthRange } from '@/lib/ledger-types';
import type { FundsData } from '@/lib/wallet-funds';
import { pathForPage } from '@/lib/routes';
import { Bear, Card } from '@/ui';
import s from './home.module.css';

type Props = {
  month: string;
  cashMonth: string;
  revision: number;
  /** Cents, allocation basis (按归属期). */
  income: number;
  netExpense: number;
  budget?: { amount: number; spent: number };
};

export function MonthCard({ month, cashMonth, revision, income, netExpense, budget }: Props) {
  const { t, locale, currency } = useI18n();
  const money = (v: number) => formatMoney(v, { language: locale, currency });
  const [cash, setCash] = useState<{ month: string; value: number | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ ...monthRange(cashMonth), owner: 'personal' });
    fetch('/api/assets/funds?' + query, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Cash flow unavailable');
        const funds: FundsData = await response.json();
        if (!controller.signal.aborted) setCash({ month: cashMonth, value: funds.summary.flowChange });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCash({ month: cashMonth, value: null });
      });
    return () => controller.abort();
  }, [cashMonth, revision]);
  const cashValue = cash?.month === cashMonth ? cash.value : undefined;
  const ratio = budget && budget.amount > 0 ? budget.spent / budget.amount : 0;
  return (
    <Card tone="accent" className={s.month} aria-label={t('本月概况')}>
      <div className={s.monthHead}>
        <strong>{t('{0} 年 {1} 月', month.split('-').map(Number))}</strong>
        <small>{t('当前账本 · 按归属期')}</small>
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
            {t('本月现金净变化')}
          </span>
          <br />
          <strong aria-live="polite">
            {typeof cashValue === 'number' ? money(cashValue) : cashValue === null ? t('暂无法读取') : '—'}
          </strong>
          <small className={s.cashBasis}>
            {t('本人钱包 · 按交易日')}
            {cashMonth !== month && <span>{t('{0} 年 {1} 月', cashMonth.split('-').map(Number))}</span>}
          </small>
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
