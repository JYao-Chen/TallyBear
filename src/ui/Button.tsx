import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import s from './ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', block, icon, className, children, type = 'button', ...rest },
  ref,
) {
  const cls = [s.button, s[variant], size === 'sm' && s.small, block && s.block, className]
    .filter(Boolean)
    .join(' ');
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {icon}
      {children}
    </button>
  );
});

type IconProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  children: ReactNode;
};

/** Square icon-only button; `label` becomes the accessible name and tooltip. */
export function IconButton({ label, children, className, type = 'button', ...rest }: IconProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[s.button, s.icon, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
