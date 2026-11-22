'use client';
import Link from 'next/link';
import { useI18n } from '@/components/LanguageProvider';
import { pathForPage, subPages, type PageKey } from '@/lib/routes';
import s from './shell.module.css';

/** Tabs between the pages of one section (分析, 钱包与计划, 设置). Renders nothing for single pages. */
export function SubNav({ page, admin }: { page: PageKey; admin: boolean }) {
  const { t } = useI18n();
  const items = subPages[page]?.filter(p => !p.admin || admin);
  if (!items || items.length < 2) return null;
  return (
    <nav className={s.subnav} aria-label={t('本栏目页面')}>
      {items.map(p => (
        <Link key={p.key} href={pathForPage(p.key)} aria-current={p.key === page ? 'page' : undefined}>
          {t(p.label)}
        </Link>
      ))}
    </nav>
  );
}
