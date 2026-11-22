'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import s from './ui.module.css';

type Toast = {
  id: number;
  text: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
};
type Api = {
  show: (text: string, options?: { tone?: Toast['tone']; action?: Toast['action']; ms?: number }) => void;
};
const ToastContext = createContext<Api>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

/** Polite live region for short confirmations; "撤销" actions stay 5 seconds by default. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setItems(v => v.filter(t => t.id !== id)), []);
  const show = useCallback<Api['show']>(
    (text, options = {}) => {
      const id = ++next.current;
      setItems(v => [...v.slice(-2), { id, text, tone: options.tone ?? 'info', action: options.action }]);
      setTimeout(() => dismiss(id), options.ms ?? (options.action ? 5000 : 3000));
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={s.toastRegion} role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={[s.toast, t.tone === 'error' && s.toastError].filter(Boolean).join(' ')}>
            <span>{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
