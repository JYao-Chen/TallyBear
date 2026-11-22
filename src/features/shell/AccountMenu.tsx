'use client';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useI18n } from '@/components/LanguageProvider';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar } from '@/components/ManagementPages';
import { themes } from '@/lib/themes';
import { pathForPage, type PageKey } from '@/lib/routes';
import { Sheet } from '@/ui';
import { pageIcons } from './nav-icons';
import s from './shell.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  user: { name: string; username: string; avatar?: string; admin?: boolean };
  busy: boolean;
  onLogout: () => void;
};

/** Avatar menu: settings and help live here; on phones it also reaches the sections missing from the tab bar. */
export function AccountMenu({ open, onClose, user, busy, onLogout }: Props) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const item = (key: PageKey, label: string) => {
    const Icon = pageIcons[key];
    return (
      <Link key={key} href={pathForPage(key)} onClick={onClose}>
        <Icon size={19} />
        {t(label)}
      </Link>
    );
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('我的')}>
      <div className={s.menuUser}>
        <Avatar value={user.avatar} size={44} />
        <span>
          <strong>{user.name}</strong>
          <small>@{user.username}</small>
        </span>
      </div>
      <div className={s.menuList}>
        <div className={s.mobileOnly}>
          {item('accounts', '钱包与计划')}
          {item('families', '家庭')}
          {item('chat', themes[theme].assistant)}
        </div>
        {item('profile', '个人资料与画像')}
        <div className={s.menuGroup}>{t('设置')}</div>
        {item('settings', '账本设置')}
        {item('books', '账本管理')}
        {user.admin && item('users', '用户管理')}
        {item('help', '使用说明')}
        <button type="button" disabled={busy} onClick={onLogout}>
          <LogOut size={19} />
          {t('退出登录')}
        </button>
      </div>
    </Sheet>
  );
}
