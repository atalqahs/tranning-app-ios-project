/**
 * Versioned localStorage envelope. Any future change to the stored shape adds
 * a step to MIGRATIONS instead of breaking existing data.
 */
import type { ProgramData } from '../domain/program/types';

const STORAGE_KEY = 'adaptive-training';
export const SCHEMA_VERSION = 1;

interface Envelope {
  version: number;
  data: unknown;
}

/** version n → n+1 */
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {};

function isProgramData(value: unknown): value is ProgramData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ProgramData>;
  return Array.isArray(v.events) && !!v.days && typeof v.days === 'object';
}

export function migrate(envelope: Envelope): ProgramData | null {
  let { version, data } = envelope;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    data = step(data);
    version++;
  }
  return version === SCHEMA_VERSION && isProgramData(data) ? data : null;
}

export function loadStored(): ProgramData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as Envelope);
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store (private mode, quota). */
export function saveStored(data: ProgramData): boolean {
  try {
    const envelope: Envelope = { version: SCHEMA_VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function clearStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored or storage unavailable: already clear.
  }
}
