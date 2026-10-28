import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'secondary', icon, block, className, children, type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, block ? 'btn--block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      <span>{children}</span>
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: icon-only controls need an accessible name. */
  label: string;
}

export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button type={type} className={['icon-btn', className ?? ''].join(' ')} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={22} />
    </button>
  );
}
