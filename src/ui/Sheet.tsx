'use client';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';
import { useI18n } from '@/components/LanguageProvider';
import s from './ui.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  closeLabel?: string;
  /** Asked before closing via Esc/backdrop/close button, e.g. when a form has unsaved input. */
  confirmClose?: () => boolean;
};

/** Modal dialog; a bottom sheet on phones. Uses the native <dialog> for focus trapping and Esc. */
export function Sheet({ open, onClose, title, children, footer, wide, closeLabel, confirmClose }: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const requestClose = () => {
    if (!confirmClose || confirmClose()) onClose();
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[s.sheet, wide && s.sheetWide].filter(Boolean).join(' ')}
      onCancel={e => {
        e.stopPropagation();
        e.preventDefault();
        requestClose();
      }}
      onClick={e => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {open && (
        <div className={s.sheetInner}>
          <header className={s.sheetHeader}>
            <h2 id={titleId}>{title}</h2>
            <IconButton label={closeLabel ?? t('关闭')} onClick={requestClose}>
              <X size={20} />
            </IconButton>
          </header>
          <div className={s.sheetBody}>{children}</div>
          {footer && <footer className={s.sheetFooter}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
