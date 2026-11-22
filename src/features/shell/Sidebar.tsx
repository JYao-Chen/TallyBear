'use client';
import Link from 'next/link';
import { NotebookPen, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar } from '@/components/ManagementPages';
import { themes } from '@/lib/themes';
import { pathForPage, sectionOf, sections, type PageKey } from '@/lib/routes';
import { Bear } from '@/ui';
import { pageIcons } from './nav-icons';
import s from './shell.module.css';

type Props = {
  page: PageKey;
  user: { name: string; avatar?: string };
  bookSwitcher: ReactNode;
  canWrite: boolean;
  onAccount: () => void;
};

export function Sidebar({ page, user, bookSwitcher, canWrite, onAccount }: Props) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const active = sectionOf(page);
  return (
    <aside className={s.sidebar} aria-label={t('侧栏')}>
      <Link href="/" className={s.brand}>
        {theme === 'bear' ? (
          <img src="/brand/tallybear-192.png" width={40} height={40} alt="" />
        ) : (
          <NotebookPen size={28} />
        )}
        <span>
          <strong>{t(themes[theme].name)}</strong>
          <small>{theme === 'bear' ? t('布布 & 一二') : t('个人与家庭财务')}</small>
        </span>
      </Link>
      {bookSwitcher}
      {canWrite && (
        <Link
          href={pathForPage('entry')}
          className={s.capture}
          aria-current={page === 'entry' ? 'page' : undefined}
        >
          <Plus size={18} />
          {t('记一笔')}
        </Link>
      )}
      <nav className={s.nav} id="primary-navigation" aria-label={t('主要导航')}>
        {sections.map(section => {
          const Icon = pageIcons[section.key];
          return (
            <Link
              key={section.key}
              href={pathForPage(section.key)}
              className={s.navLink}
              aria-current={active === section.key ? 'page' : undefined}
            >
              <Icon size={19} />
              {t(section.label)}
            </Link>
          );
        })}
      </nav>
      <Link
        href={pathForPage('chat')}
        className={s.assistant}
        aria-current={page === 'chat' ? 'page' : undefined}
      >
        <Bear pose="thinking" size={40} />
        <span>
          {t(themes[theme].assistant)}
          <small>{t('问账、记账、核对')}</small>
        </span>
      </Link>
      <button type="button" className={s.account} onClick={onAccount} aria-haspopup="dialog">
        <Avatar value={user.avatar} size={32} />
        <span>{user.name}</span>
      </button>
    </aside>
  );
}
