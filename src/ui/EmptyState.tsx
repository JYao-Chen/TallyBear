'use client';
import type { ReactNode } from 'react';
import { Bear, type BearPose } from './Bear';
import s from './ui.module.css';

export function EmptyState({
  title,
  children,
  action,
  pose = 'quiet',
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  pose?: BearPose;
}) {
  return (
    <div className={s.empty}>
      <Bear pose={pose} size={72} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
