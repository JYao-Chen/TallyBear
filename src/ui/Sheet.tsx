'use client';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';
import { useI18n } from '@/components/LanguageProvider';
import { lockModalScroll } from '@/lib/modal-scroll';
import s from './ui.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  picker?: boolean;
  closeLabel?: string;
  /** Asked before closing via Esc/backdrop/close button, e.g. when a form has unsaved input. */
  confirmClose?: () => boolean;
};

/** Modal dialog; a bottom sheet on phones. Uses the native <dialog> for focus trapping and Esc. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  picker,
  closeLabel,
  confirmClose,
}: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!open) {
      if (d.open) d.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockModalScroll();
    if (!d.open) d.showModal();
    if (picker) {
      d.querySelector<HTMLElement>(
        'input, [aria-pressed="true"], .choice-search input, .choice-option[aria-pressed="true"], .calendar-days button[aria-pressed="true"], .calendar-months button[aria-pressed="true"]',
      )?.focus({ preventScroll: true });
    }
    return () => {
      if (d.open) d.close();
      unlock();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, picker]);
  const requestClose = () => {
    if (!confirmClose || confirmClose()) onClose();
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={[s.sheet, wide && s.sheetWide, picker && s.sheetPicker].filter(Boolean).join(' ')}
      onCancel={e => {
        e.stopPropagation();
        e.preventDefault();
        requestClose();
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            requestClose();
        }
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
