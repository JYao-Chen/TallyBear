import { ChevronDown } from 'lucide-react';
import {
  useId,
  type ComponentPropsWithRef,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import s from './ui.module.css';

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Receives the generated id and aria props; spread them onto the control. */
  children: (control: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
};

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const note = error || hint ? id + '-note' : undefined;
  return (
    <div className={[s.field, className].filter(Boolean).join(' ')}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': note })}
      {error ? (
        <span id={note} className={s.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={note} className={s.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithRef<'input'>) {
  return <input className={[s.control, className].filter(Boolean).join(' ')} {...rest} />;
}
export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[s.control, className].filter(Boolean).join(' ')} {...rest} />;
}
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={[s.selectWrap, className].filter(Boolean).join(' ')}>
      <select className={s.control} {...rest} />
      <ChevronDown size={18} aria-hidden="true" />
    </span>
  );
}
