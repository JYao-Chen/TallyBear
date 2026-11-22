'use client';
import { useState, type ReactNode } from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { ConfirmDialog } from './ConfirmDialog';

/** Keep the proposed action with its prompt until the user confirms or dismisses it. */
export function useConfirmation() {
  const { t } = useI18n();
  const [pending, setPending] = useState<{ message: ReactNode; action: () => void } | null>(null);
  function requestConfirmation(message: ReactNode, action: () => void) {
    setPending({ message, action });
  }
  const confirmation = pending && (
    <ConfirmDialog
      open
      title={t('确认')}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        setPending(null);
        pending.action();
      }}
    >
      {pending.message}
    </ConfirmDialog>
  );
  return { confirmation, requestConfirmation };
}
