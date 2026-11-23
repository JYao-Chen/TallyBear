'use client';

import { useId, type ChangeEventHandler, type ReactNode } from 'react';
import s from './ui.module.css';

export function CheckboxRow({
  title,
  description,
  icon,
  checked,
  mixed = false,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  checked: boolean;
  mixed?: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <label className={s.checkboxRow}>
      <input
        type="checkbox"
        aria-labelledby={id}
        aria-describedby={description ? id + '-description' : undefined}
        checked={checked}
        disabled={disabled}
        ref={input => {
          if (input) input.indeterminate = mixed;
        }}
        onChange={onChange}
      />
      <span className={s.checkboxContent}>
        {icon && (
          <span aria-hidden="true" className={s.checkboxIcon}>
            {icon}
          </span>
        )}
        <span className={s.checkboxCopy}>
          <strong id={id}>{title}</strong>
          {description && <small id={id + '-description'}>{description}</small>}
        </span>
      </span>
    </label>
  );
}
