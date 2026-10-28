import { useId, useState } from 'react';
import { normalizeDigits, parseCount, parseDecimal } from '../format';

interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
  placeholder?: string;
}

const show = (v: number | null) => (v === null ? '' : String(v));

/**
 * Keeps the typed text (e.g. "2.") locally and reports parsed numbers.
 * Empty means "not entered", which the engine treats differently from 0.
 */
export function NumberField({ label, value, onChange, decimal, max, suffix, disabled, hideLabel, placeholder }: NumberFieldProps) {
  const id = useId();
  const [text, setText] = useState(show(value));
  const parse = decimal ? parseDecimal : parseCount;
  // Resync when the value changes from outside (another day, a reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parse(text) !== value) setText(show(value));
  }

  const invalid = text.trim() !== '' && parse(text) === null;

  return (
    <label className={`field${disabled ? ' field--disabled' : ''}${invalid ? ' field--invalid' : ''}`} htmlFor={id}>
      <span className={hideLabel ? 'sr-only' : 'field__label'}>{label}</span>
      <span className="field__box">
        <input
          id={id}
          className="field__input"
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          pattern={decimal ? undefined : '[0-9]*'}
          autoComplete="off"
          enterKeyHint="done"
          dir="ltr"
          disabled={disabled}
          placeholder={placeholder ?? '—'}
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            const next = normalizeDigits(e.target.value);
            setText(next);
            const parsed = parse(next);
            if (next.trim() === '') onChange(null);
            else if (parsed !== null && (max === undefined || parsed <= max)) onChange(parsed);
          }}
        />
        {suffix ? <span className="field__suffix">{suffix}</span> : null}
      </span>
    </label>
  );
}

interface DurationFieldProps {
  label: string;
  /** Total seconds, or null when not entered. */
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

/** Minutes and seconds as two numeric boxes; seconds limited to 0–59. */
export function DurationField({ label, value, onChange, disabled }: DurationFieldProps) {
  const minutes = value === null ? null : Math.floor(value / 60);
  const seconds = value === null ? null : value % 60;
  const update = (m: number | null, s: number | null) => {
    if (m === null && s === null) onChange(null);
    else onChange((m ?? 0) * 60 + (s ?? 0));
  };
  return (
    <fieldset className="duration" disabled={disabled}>
      <legend className="field__label">{label}</legend>
      <div className="duration__row">
        <NumberField label={`${label} — دقائق`} hideLabel value={minutes} suffix="د" onChange={(m) => update(m, seconds)} disabled={disabled} />
        <NumberField label={`${label} — ثوانٍ`} hideLabel value={seconds} suffix="ث" max={59} onChange={(s) => update(minutes, s)} disabled={disabled} />
      </div>
    </fieldset>
  );
}
