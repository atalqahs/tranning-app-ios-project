import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Card({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section className={['card', className ?? ''].join(' ')} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}

export function ProgressBar({ percent, label, accent }: { percent: number; label: string; accent?: boolean }) {
  const value = Math.round(Math.min(100, Math.max(0, percent)));
  return (
    <div
      className={`bar${accent ? ' bar--accent' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className="bar__fill" style={{ inlineSize: `${value}%` }} />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle${checked ? ' toggle--on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="toggle__box" aria-hidden="true">
        {checked ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' }) {
  return <p className={`notice notice--${tone}`}>{children}</p>;
}
