'use client';
import { useState, type ReactNode } from 'react';
import { ConfirmDialog, ToastProvider, useToast } from '@/ui';
import { useI18n } from './LanguageProvider';

type Confirmation = { title: string; detail: string; resolve: (confirmed: boolean) => void };
type Props = {
  children: (
    saved: (undo?: () => Promise<void>) => void,
    confirm: (title: string, detail: string) => Promise<boolean>,
  ) => ReactNode;
};
export function EntrySaveFeedback(props: Props) {
  return (
    <ToastProvider>
      <FeedbackControls {...props} />
    </ToastProvider>
  );
}
function FeedbackControls({ children }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const [request, setRequest] = useState<Confirmation | null>(null);
  const confirm = (title: string, detail: string) =>
    new Promise<boolean>(resolve => setRequest({ title, detail, resolve }));
  const finish = (confirmed: boolean) => {
    request?.resolve(confirmed);
    setRequest(null);
  };
  const saved = (undo?: () => Promise<void>) => {
    toast.show(t('已记一笔'), {
      ms: 5000,
      action: undo
        ? {
            label: t('撤销'),
            run: async () => {
              if (!(await confirm(t('撤销这笔记录？'), t('这笔记录将从账本移除。')))) return;
              try {
                await undo();
              } catch (e) {
                toast.show(t((e as Error).message), { tone: 'error' });
              }
            },
          }
        : undefined,
    });
  };
  return (
    <>
      {children(saved, confirm)}
      <ConfirmDialog
        open={!!request}
        title={request?.title}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      >
        {request?.detail}
      </ConfirmDialog>
    </>
  );
}
