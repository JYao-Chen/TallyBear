'use client';
import Link from 'next/link';
import { ChartNoAxesCombined, Home, ListOrdered, Menu, Plus } from 'lucide-react';
import { useI18n } from '@/components/LanguageProvider';
import { pathForPage, sectionOf, type PageKey } from '@/lib/routes';
import s from './shell.module.css';

/** Phone bottom bar: 首页、流水、＋记一笔、分析、我的. */
export function MobileTabBar({ page, onMenu }: { page: PageKey; onMenu: () => void }) {
  const { t } = useI18n();
  const active = sectionOf(page);
  const tab = (key: PageKey, label: string, Icon: typeof Home, current: boolean) => (
    <Link href={pathForPage(key)} className={s.tab} aria-current={current ? 'page' : undefined}>
      <Icon size={21} />
      {t(label)}
    </Link>
  );
  return (
    <nav className={s.tabbar} aria-label={t('手机导航')}>
      {tab('home', '首页', Home, page === 'home')}
      {tab('entries', '流水', ListOrdered, active === 'entries')}
      <Link
        href={pathForPage('entry')}
        className={`${s.tab} ${s.tabPrimary}`}
        aria-label={t('记一笔')}
        aria-current={page === 'entry' ? 'page' : undefined}
      >
        <Plus size={24} />
      </Link>
      {tab('insights', '分析', ChartNoAxesCombined, active === 'insights')}
      <button type="button" className={s.tab} onClick={onMenu} aria-haspopup="dialog">
        <Menu size={21} />
        {t('我的')}
      </button>
    </nav>
  );
}
