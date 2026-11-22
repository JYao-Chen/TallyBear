import type { HTMLAttributes, ReactNode } from 'react';
import s from './ui.module.css';

type Props = HTMLAttributes<HTMLElement> & {
  tone?: 'plain' | 'raised' | 'accent';
  title?: ReactNode;
  action?: ReactNode;
  as?: 'section' | 'div' | 'article';
};

export function Card({
  tone = 'plain',
  title,
  action,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: Props) {
  const cls = [s.card, tone === 'raised' && s.cardRaised, tone === 'accent' && s.cardAccent, className]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={cls} {...rest}>
      {(title || action) && (
        <header className={s.cardHeader}>
          {title && <h2 className={s.cardTitle}>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
