/**
 * Calendar math on plain `YYYY-MM-DD` keys.
 *
 * Every "what day is it" question is answered in Asia/Kuwait. Once a key exists,
 * arithmetic is done on UTC midnights of that key, so no local-time or DST
 * conversion can shift a date.
 */

export type DateKey = string;

export const TIME_ZONE = 'Asia/Kuwait';

const DAY_MS = 86_400_000;

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Today's date in Kuwait. */
export function todayKey(now: Date = new Date()): DateKey {
  return keyFormatter.format(now);
}

/** Milliseconds until the next Kuwait midnight (when today's results lock). */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const [h, m, s] = clockFormatter.format(now).split(':').map(Number) as [number, number, number];
  const elapsed = ((h * 60 + m) * 60 + s) * 1000 + now.getMilliseconds();
  return Math.max(1000, DAY_MS - elapsed);
}

function toUtc(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtc(toUtc(key) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DateKey): number {
  return new Date(toUtc(key)).getUTCDay();
}

/** Sunday–Thursday are scheduled training days; Friday and Saturday are rest. */
export function isTrainingDay(key: DateKey): boolean {
  return weekday(key) <= 4;
}

export function isSunday(key: DateKey): boolean {
  return weekday(key) === 0;
}

/** The Sunday that starts the week containing `key`. */
export function weekStart(key: DateKey): DateKey {
  return addDays(key, -weekday(key));
}

export function weekDays(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function dayParts(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}
