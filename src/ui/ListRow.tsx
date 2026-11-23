import Link from 'next/link';
import type { ReactNode } from 'react';
import s from './ui.module.css';

type Props = {
  disabled?: boolean;
  'aria-label'?: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  endMeta?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Marks the current choice in a picker list. */
  selected?: boolean;
};

/** One line per record: icon, title + meta, right-aligned amount. Renders a link, button or plain row. */
export function ListRow({
  leading,
  title,
  meta,
  end,
  endMeta,
  href,
  onClick,
  className,
  selected,
  disabled,
  'aria-label': label,
}: Props) {
  const body = (
    <>
      <span>{leading}</span>
      <span className={s.listRowBody}>
        <span className={s.listRowTitle}>{title}</span>
        {meta && <span className={s.listRowMeta}>{meta}</span>}
      </span>
      <span className={s.listRowEnd}>
        {end}
        {endMeta && <span className={s.listRowMeta}>{endMeta}</span>}
      </span>
    </>
  );
  const cls = [s.listRow, className].filter(Boolean).join(' ');
  if (href)
    return (
      <Link href={href} className={cls} scroll={false}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-current={selected || undefined}
        className={cls}
        onClick={onClick}
      >
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}
