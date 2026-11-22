'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { Bear } from '@/ui';
import s from './home.module.css';

function partOfDay(hour: number) {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function Greeting({ name, book, readOnly }: { name: string; book?: string; readOnly?: boolean }) {
  const { t } = useI18n();
  // Rendered after mount so server and client agree on the hour.
  const [hello, setHello] = useState('你好');
  useEffect(() => setHello(partOfDay(new Date().getHours())), []);
  return (
    <div className={s.greeting}>
      <Bear pose="hello" size={56} />
      <div>
        <h1>{t('{0}，{1}', [t(hello), name])}</h1>
        <p>
          {book ? t('当前账本：') + book : ''}
          {readOnly ? ' · ' + t('只读权限') : ''}
        </p>
      </div>
    </div>
  );
}
