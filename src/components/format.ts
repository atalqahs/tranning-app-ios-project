import { dayParts, weekday, type DateKey } from '../domain/calendar/dateUtils';

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
export const DAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] as const;
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'] as const;

export function formatFullDate(key: DateKey): string {
  const { year, month, day } = dayParts(key);
  return `${DAY_NAMES[weekday(key)]}، ${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatShortDate(key: DateKey): string {
  const { month, day } = dayParts(key);
  return `${day} ${MONTHS[month - 1]}`;
}

export function formatWeekRange(start: DateKey, end: DateKey): string {
  const a = dayParts(start);
  const b = dayParts(end);
  return a.month === b.month
    ? `${a.day} – ${b.day} ${MONTHS[b.month - 1]}`
    : `${a.day} ${MONTHS[a.month - 1]} – ${b.day} ${MONTHS[b.month - 1]}`;
}

/** 1500 → "25:00" */
export function formatClock(totalSec: number): string {
  const sec = Math.round(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds as a short spoken duration: 90 → "90 ث", 180 → "3 د". */
export function formatSpan(sec: number): string {
  if (sec < 120 && sec % 60 !== 0) return `${sec} ث`;
  if (sec % 60 === 0) return `${sec / 60} د`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} د`;
}

export function formatRest([min, max]: readonly [number, number]): string {
  return `${formatSpan(min)} – ${formatSpan(max)}`;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** iPhone Arabic keyboards type ٠–٩ and "٫"; the engine needs 0–9 and ".". */
export function normalizeDigits(text: string): string {
  return text
    .replace(ARABIC_DIGITS, (c) => String((c.charCodeAt(0) & 0xf) % 10))
    .replace(/[٫,،]/g, '.');
}

export function parseCount(text: string): number | null {
  const t = normalizeDigits(text).trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

export function parseDecimal(text: string): number | null {
  const t = normalizeDigits(text).trim();
  if (t === '' || !/^\d*\.?\d*$/.test(t) || t === '.') return null;
  return Number(t);
}
