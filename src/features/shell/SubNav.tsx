'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { pathForPage, subPages, type PageKey } from '@/lib/routes';
import s from './shell.module.css';

/** Tabs between the pages of one section (分析, 钱包与计划, 设置). Renders nothing for single pages. */
export function SubNav({ page, admin }: { page: PageKey; admin: boolean }) {
  const { t } = useI18n();
  const nav = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  const items = subPages[page]?.filter(p => !p.admin || admin);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && active.offsetLeft + active.offsetWidth > el.clientWidth)
      el.scrollLeft = active.offsetLeft - el.clientWidth / 3;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [page]);
  if (!items || items.length < 2) return null;
  return (
    <nav ref={nav} className={s.subnav} data-more={more || undefined} aria-label={t('本栏目页面')}>
      {items.map(p => (
        <Link key={p.key} href={pathForPage(p.key)} aria-current={p.key === page ? 'page' : undefined}>
          {t(p.label)}
        </Link>
      ))}
    </nav>
  );
}
