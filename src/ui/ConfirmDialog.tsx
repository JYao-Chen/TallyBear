'use client';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { useI18n } from '@/components/LanguageProvider';

/** Second confirmation for high-risk actions (delete, permissions, family members, balance corrections). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = true,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel}>{t('取消')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>
            {confirmLabel ?? t('确认')}
          </Button>
        </>
      }
    >
      {children}
    </Sheet>
  );
}
