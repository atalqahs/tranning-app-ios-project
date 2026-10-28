import { isEntered } from './successRules';
import type { Evaluation, Ladder, PushEntry, PushPosition, PushPrescription } from './types';

export const PUSH_GOAL = 70;

/** Incline / wall push-ups, 3 sets each, only for when knee push-ups are not possible yet. */
export const INCLINE_REPS: readonly number[] = [6, 8, 10, 12, 15];
const INCLINE_SETS = 3;

/** Knee push-ups, 4 sets each. */
export const KNEE_REPS: readonly number[] = [4, 6, 8, 10, 12];
const KNEE_SETS = 4;

/** ض1 … ض11: strict reps required in each of the 4 sets of 10. */
export const TRANSITION_NORMALS: readonly (readonly number[])[] = [
  [1, 0, 0, 0],
  [1, 1, 0, 0],
  [1, 1, 1, 0],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
  [3, 3, 3, 3],
  [4, 4, 4, 4],
  [5, 5, 5, 5],
  [6, 6, 6, 6],
  [8, 8, 8, 8],
  [10, 10, 10, 10],
];
export const TRANSITION_SET_TOTAL = 10;

/** First endurance main set after finishing ض11 (4 × 10 strict). */
const TRANSITION_EXIT_MAIN = 11;

/** From this many strict reps the endurance phase can start directly. */
export const ENDURANCE_ENTRY_REPS = 10;
export const ENDURANCE_MAIN_RATIO = 0.7;
const SUPPORT_RATIO = 0.6;
/** From this main set size the support work drops to a single set. */
const SINGLE_SUPPORT_FROM = 50;

const MAINTAIN_SETS = [35, 35];

const LAST_INCLINE = INCLINE_REPS.length - 1;
const LAST_KNEE = KNEE_REPS.length - 1;
const LAST_TRANSITION = TRANSITION_NORMALS.length - 1;

/** Reps added to the main set after two successes in a row. */
export function pushIncrement(main: number): number {
  if (main < 15) return 1;
  if (main < 60) return 2;
  return 1;
}

export function enduranceMainFromBest(best: number): number {
  return Math.max(1, Math.floor(ENDURANCE_MAIN_RATIO * best));
}

export const pushLadder: Ladder<PushPosition> = {
  next(p) {
    switch (p.phase) {
      case 'incline':
        return p.stage < LAST_INCLINE ? { phase: 'incline', stage: p.stage + 1 } : { phase: 'knee', stage: 0 };
      case 'knee':
        return p.stage < LAST_KNEE ? { phase: 'knee', stage: p.stage + 1 } : { phase: 'transition', stage: 0 };
      case 'transition':
        return p.stage < LAST_TRANSITION
          ? { phase: 'transition', stage: p.stage + 1 }
          : { phase: 'endurance', main: TRANSITION_EXIT_MAIN };
      case 'endurance':
        return p.main >= PUSH_GOAL ? null : { phase: 'endurance', main: Math.min(PUSH_GOAL, p.main + pushIncrement(p.main)) };
      case 'maintain':
        return null;
    }
  },
  prev(p) {
    switch (p.phase) {
      case 'incline':
        return p.stage > 0 ? { phase: 'incline', stage: p.stage - 1 } : null;
      case 'knee':
        return p.stage > 0 ? { phase: 'knee', stage: p.stage - 1 } : { phase: 'incline', stage: LAST_INCLINE };
      case 'transition':
        return p.stage > 0 ? { phase: 'transition', stage: p.stage - 1 } : { phase: 'knee', stage: LAST_KNEE };
      case 'endurance': {
        if (p.main <= 1) return { phase: 'transition', stage: LAST_TRANSITION };
        const twoBack = p.main - 2;
        const main = twoBack >= 1 && pushIncrement(twoBack) === 2 ? twoBack : p.main - 1;
        return { phase: 'endurance', main };
      }
      case 'maintain':
        return null;
    }
  },
  rank(p) {
    switch (p.phase) {
      case 'incline':
        return p.stage;
      case 'knee':
        return 10 + p.stage;
      case 'transition':
        return 20 + p.stage;
      case 'endurance':
        return 100 + p.main;
      case 'maintain':
        return 1000;
    }
  },
};

export function pushPositionLabel(p: PushPosition): string {
  switch (p.phase) {
    case 'incline':
      return `مائل ${INCLINE_SETS}×${INCLINE_REPS[p.stage]}`;
    case 'knee':
      return `بالركب ${KNEE_SETS}×${KNEE_REPS[p.stage]}`;
    case 'transition':
      return `ض${p.stage + 1}`;
    case 'endurance':
      return `رئيسية ${p.main} طبيعي`;
    case 'maintain':
      return 'محقق — محافظة';
  }
}

function restFor(p: PushPosition): readonly [number, number] {
  switch (p.phase) {
    case 'incline':
    case 'knee':
      return [90, 120];
    case 'transition':
      return [90, 150];
    case 'endurance':
      if (p.main < 30) return [90, 120];
      if (p.main < 50) return [120, 150];
      return [150, 180];
    case 'maintain':
      return [120, 150];
  }
}

export function prescribePush(p: PushPosition): PushPrescription {
  const restSec = restFor(p);
  const code = pushPositionLabel(p);
  switch (p.phase) {
    case 'incline': {
      const reps = INCLINE_REPS[p.stage]!;
      return { kind: 'incline', code, assisted: 'incline', restSec, sets: repeat(INCLINE_SETS, { total: reps, normalMin: 0 }) };
    }
    case 'knee': {
      const reps = KNEE_REPS[p.stage]!;
      return { kind: 'knee', code, assisted: 'knee', restSec, sets: repeat(KNEE_SETS, { total: reps, normalMin: 0 }) };
    }
    case 'transition':
      return {
        kind: 'transition',
        code,
        assisted: 'knee',
        restSec,
        sets: TRANSITION_NORMALS[p.stage]!.map((normalMin) => ({ total: TRANSITION_SET_TOTAL, normalMin })),
      };
    case 'endurance': {
      const support = Math.max(1, Math.round(SUPPORT_RATIO * p.main));
      const supportSets = p.main >= SINGLE_SUPPORT_FROM ? 1 : 2;
      const sets = [p.main, ...Array<number>(supportSets).fill(support)];
      return { kind: 'endurance', code, assisted: null, restSec, sets: sets.map((n) => ({ total: n, normalMin: n })) };
    }
    case 'maintain':
      return {
        kind: 'maintain',
        code,
        assisted: null,
        restSec,
        sets: MAINTAIN_SETS.map((n) => ({ total: n, normalMin: n })),
      };
  }
}

function repeat<T>(count: number, value: T): T[] {
  return Array.from({ length: count }, () => ({ ...value }));
}

export function hasPushData(entry: PushEntry | undefined): entry is PushEntry {
  return !!entry && entry.sets.some((s) => isEntered(s.normal) || isEntered(s.assisted));
}

/**
 * Strict reps replace assisted reps inside a set's total; they never add a
 * second load. Every prescribed set must reach both its total and its strict
 * minimum.
 */
export function evaluatePush(rx: PushPrescription, entry: PushEntry | undefined): Evaluation {
  if (!hasPushData(entry)) return 'none';
  const ok = rx.sets.every((target, i) => {
    const set = entry.sets[i];
    const normal = set?.normal ?? 0;
    const assisted = rx.assisted ? (set?.assisted ?? 0) : 0;
    return normal >= target.normalMin && normal + assisted >= target.total;
  });
  return ok ? 'success' : 'fail';
}

/** Best strict push-ups done without a break: the largest single set, never a sum. */
export function bestStrictSet(sets: readonly { normal: number | null }[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (isEntered(s.normal) && (best === null || s.normal > best)) best = s.normal;
  }
  return best;
}
